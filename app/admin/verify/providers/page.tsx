import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { listVerifyProviders } from "@/lib/verify/provider-registry";
import { providerRolloutIsReady, type VerifyProviderRollout } from "@/lib/verify-rollout";
import {
  addVerifyProviderCohortMember,
  pauseVerifyProvider,
  removeVerifyProviderCohortMember,
  updateVerifyProviderGovernance
} from "@/app/admin/verify/providers/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "VeriFy provider gates" };

type Subscription = {
  id: string;
  client_id: string;
  status: string;
  account_reference: string | null;
  verify_enabled: boolean;
  service: { name: string; verify_enabled: boolean; verify_provider: string | null } | Array<{ name: string; verify_enabled: boolean; verify_provider: string | null }> | null;
};
type Client = { id: string; display_name: string | null; email: string | null };
type Cohort = { id: string; provider: string; client_subscription_id: string; note: string; created_at: string };

const successMessages: Record<string, string> = {
  governance_updated: "Provider governance and rollout status were updated.",
  provider_paused: "The provider was stopped immediately. Other VeriFy providers are unaffected.",
  cohort_added: "The subscription was added to the pilot cohort.",
  cohort_removed: "The subscription was removed from the pilot cohort."
};
const errorMessages: Record<string, string> = {
  readiness_incomplete: "Pilot and live status require authorization, terms review, an incident owner, a runbook, and every readiness check.",
  pause_reason_required: "Add a short incident or shutdown reason.",
  cohort_subscription_ineligible: "Only eligible, assigned subscriptions for this provider can join its pilot cohort."
};

function related<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] || null : value;
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

export default async function VerifyProvidersPage({
  searchParams
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const [rolloutResult, cohortResult, subscriptionResult, clientResult] = await Promise.all([
    admin.from("uniplug_verify_provider_rollouts").select("provider,operational_status,authorization_status,authorization_model,authorization_reference,terms_review_status,code_semantics,incident_owner,support_runbook_reference,sender_allowlist_reviewed,parser_fixtures_reviewed,expiry_rules_reviewed,abuse_limits_reviewed,forbidden_code_classes_confirmed,support_runbook_reviewed,shutdown_reason,approved_at,updated_at").order("provider"),
    admin.from("uniplug_verify_provider_cohorts").select("id,provider,client_subscription_id,note,created_at").order("created_at", { ascending: false }),
    admin.from("client_subscriptions").select("id,client_id,status,account_reference,verify_enabled,service:client_services!client_subscriptions_service_id_fkey(name,verify_enabled,verify_provider)").order("updated_at", { ascending: false }).limit(500),
    admin.from("clients").select("id,display_name,email").limit(1000)
  ]);
  const loadError = rolloutResult.error || cohortResult.error || subscriptionResult.error || clientResult.error;
  if (loadError) throw new Error(`VeriFy provider gates could not be loaded: ${loadError.message}`);

  const rolloutMap = new Map(((rolloutResult.data || []) as VerifyProviderRollout[]).map((row) => [row.provider, row]));
  const cohorts = (cohortResult.data || []) as Cohort[];
  const subscriptions = (subscriptionResult.data || []) as Subscription[];
  const subscriptionMap = new Map(subscriptions.map((row) => [row.id, row]));
  const clientMap = new Map(((clientResult.data || []) as Client[]).map((client) => [client.id, client]));
  const registry = listVerifyProviders();

  return (
    <section className="section shell page-top portal-page verify-governance-page">
      <div className="dashboard-heading admin-dashboard-heading">
        <div>
          <p className="eyebrow">VeriFy governance</p>
          <h1>Provider rollout gates</h1>
          <p>Document authorization, require technical readiness, pilot with explicit subscriptions, and stop one provider instantly.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-light" href="/admin/mailboxes">Mailbox operations</Link>
        </div>
      </div>

      {query.success && successMessages[query.success] ? <p className="form-success page-notice">{successMessages[query.success]}</p> : null}
      {query.error && errorMessages[query.error] ? <p className="form-error page-notice">{errorMessages[query.error]}</p> : null}
      <p className="form-success page-notice">Only providers in the reviewed code registry appear here. No form can create a sender query, parser, or unsupported provider.</p>

      <div className="verify-governance-grid">
        {registry.map((provider) => {
          const rollout = rolloutMap.get(provider.id);
          if (!rollout) return <article className="panel" key={provider.id}><h2>{provider.displayName}</h2><p className="form-error">Provider governance is not configured. Keep this provider disabled.</p></article>;
          const ready = providerRolloutIsReady(rollout);
          const providerCohorts = cohorts.filter((row) => row.provider === provider.id);
          const eligibleSubscriptions = subscriptions.filter((subscription) => {
            const service = related(subscription.service);
            return service?.verify_provider === provider.id && provider.isEligible({
              status: subscription.status,
              capabilityEnabled: Boolean(service.verify_enabled && subscription.verify_enabled),
              hasAssignedAccount: Boolean(subscription.account_reference?.trim())
            });
          });
          return (
            <article className="panel verify-governance-card" key={provider.id}>
              <header>
                <div className="verify-provider-mark" aria-hidden="true">{provider.mark}</div>
                <div><p className="eyebrow">Reviewed provider</p><h2>{provider.displayName}</h2><span>{provider.id}</span></div>
                <span className={`status-pill ${rollout.operational_status === "live" ? "status-active" : rollout.operational_status === "paused" ? "status-cancelled" : "status-pending"}`}>{readable(rollout.operational_status)}</span>
              </header>

              <div className="verify-provider-metrics">
                <span>Readiness<b>{ready ? "Passed" : "Incomplete"}</b></span>
                <span>Authorization<b>{readable(rollout.authorization_status)}</b></span>
                <span>Terms review<b>{readable(rollout.terms_review_status)}</b></span>
                <span>Pilot cohort<b>{providerCohorts.length} subscription{providerCohorts.length === 1 ? "" : "s"}</b></span>
              </div>

              {rollout.shutdown_reason ? <p className="form-error">Shutdown note: {rollout.shutdown_reason}</p> : null}

              <form action={updateVerifyProviderGovernance} className="verify-governance-form">
                <input name="provider" type="hidden" value={provider.id} />
                <div className="verify-governance-fields three">
                  <label>Operational status<select defaultValue={rollout.operational_status} name="operationalStatus"><option value="disabled">Disabled</option><option value="pilot">Pilot cohort only</option><option value="live">Live for eligible members</option><option value="paused">Paused</option></select></label>
                  <label>Authorization<select defaultValue={rollout.authorization_status} name="authorizationStatus"><option value="pending">Pending</option><option value="approved">Approved</option><option value="revoked">Revoked</option></select></label>
                  <label>Terms review<select defaultValue={rollout.terms_review_status} name="termsReviewStatus"><option value="pending">Pending</option><option value="approved">Approved</option><option value="blocked">Blocked</option></select></label>
                </div>
                <label>Authorization model<textarea defaultValue={rollout.authorization_model} maxLength={1200} name="authorizationModel" required /></label>
                <div className="verify-governance-fields two">
                  <label>Authorization reference<input defaultValue={rollout.authorization_reference} maxLength={300} name="authorizationReference" required /></label>
                  <label>Incident owner<input defaultValue={rollout.incident_owner} maxLength={160} name="incidentOwner" required /></label>
                </div>
                <label>Allowed code semantics<textarea defaultValue={rollout.code_semantics} maxLength={600} name="codeSemantics" required /></label>
                <label>Support runbook reference<input defaultValue={rollout.support_runbook_reference} maxLength={300} name="supportRunbookReference" required /></label>
                <fieldset className="verify-readiness-checks">
                  <legend>Activation gates</legend>
                  <label><input defaultChecked={rollout.sender_allowlist_reviewed} name="senderAllowlistReviewed" type="checkbox" /> Sender allowlist reviewed</label>
                  <label><input defaultChecked={rollout.parser_fixtures_reviewed} name="parserFixturesReviewed" type="checkbox" /> Sanitized parser fixtures pass</label>
                  <label><input defaultChecked={rollout.expiry_rules_reviewed} name="expiryRulesReviewed" type="checkbox" /> Expiry rules reviewed</label>
                  <label><input defaultChecked={rollout.abuse_limits_reviewed} name="abuseLimitsReviewed" type="checkbox" /> Abuse limits reviewed</label>
                  <label><input defaultChecked={rollout.forbidden_code_classes_confirmed} name="forbiddenCodeClassesConfirmed" type="checkbox" /> Reset, financial, and identity codes rejected</label>
                  <label><input defaultChecked={rollout.support_runbook_reviewed} name="supportRunbookReviewed" type="checkbox" /> Support runbook reviewed</label>
                </fieldset>
                <button className="button button-dark" type="submit">Save governance</button>
              </form>

              <div className="verify-kill-switch">
                <div><strong>Instant provider shutdown</strong><p>Pausing is enforced before rate reservation or mailbox access and does not affect other providers.</p></div>
                <form action={pauseVerifyProvider}>
                  <input name="provider" type="hidden" value={provider.id} />
                  <input aria-label="Shutdown reason" maxLength={300} name="reason" placeholder="Incident or shutdown reason" required />
                  <ConfirmSubmitButton className="button button-danger" confirmation={`Pause ${provider.displayName} VeriFy now?`} type="submit">Pause now</ConfirmSubmitButton>
                </form>
              </div>

              <section className="verify-cohort-panel">
                <div className="section-heading compact"><div><p className="eyebrow">Staged rollout</p><h3>Pilot cohort</h3></div><span>{rollout.operational_status === "pilot" ? "Enforced now" : "Stored for next pilot"}</span></div>
                <form action={addVerifyProviderCohortMember} className="verify-cohort-add">
                  <input name="provider" type="hidden" value={provider.id} />
                  <label>Eligible subscription<select name="subscriptionId" required><option value="">Select a subscription</option>{eligibleSubscriptions.map((subscription) => { const client = clientMap.get(subscription.client_id); const service = related(subscription.service); return <option key={subscription.id} value={subscription.id}>{client?.display_name || client?.email || subscription.client_id} · {service?.name || provider.displayName} · {subscription.account_reference}</option>; })}</select></label>
                  <label>Safe note<input maxLength={240} name="note" placeholder="Internal pilot reason" /></label>
                  <button className="button button-light" type="submit">Add to cohort</button>
                </form>
                <div className="verify-cohort-list">
                  {providerCohorts.map((cohort) => {
                    const subscription = subscriptionMap.get(cohort.client_subscription_id);
                    const client = subscription ? clientMap.get(subscription.client_id) : null;
                    return <article key={cohort.id}><div><strong>{client?.display_name || client?.email || "Subscription"}</strong><span>{cohort.client_subscription_id}</span><small>{cohort.note || "No pilot note"}</small></div><form action={removeVerifyProviderCohortMember}><input name="cohortId" type="hidden" value={cohort.id} /><ConfirmSubmitButton className="button button-light" confirmation="Remove this subscription from the pilot cohort?" type="submit">Remove</ConfirmSubmitButton></form></article>;
                  })}
                  {!providerCohorts.length ? <p className="muted-copy">No pilot subscriptions. A provider in pilot mode will remain unavailable until subscriptions are added here.</p> : null}
                </div>
              </section>
            </article>
          );
        })}
      </div>
    </section>
  );
}
