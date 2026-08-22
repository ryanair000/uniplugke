import Link from "next/link";
import { AdminDrawer } from "@/components/admin-drawer";
import { AdminEmptyState, AdminMetricStrip, AdminPageHeader, AdminSection, AdminStatus } from "@/components/admin-console";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { listVerifyProviders } from "@/lib/verify/provider-registry";
import { providerRolloutIsReady, type VerifyProviderRollout } from "@/lib/verify-rollout";
import { addVerifyProviderCohortMember, pauseVerifyProvider, removeVerifyProviderCohortMember, updateVerifyProviderGovernance } from "@/app/admin/verify/providers/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "VeriFy provider gates" };

type Subscription = { id: string; client_id: string; status: string; account_reference: string | null; verify_enabled: boolean; service: { name: string; verify_enabled: boolean; verify_provider: string | null } | Array<{ name: string; verify_enabled: boolean; verify_provider: string | null }> | null };
type Client = { id: string; display_name: string | null; email: string | null };
type Cohort = { id: string; provider: string; client_subscription_id: string; note: string; created_at: string };

const successMessages: Record<string, string> = { governance_updated: "Provider governance updated.", provider_paused: "Provider paused immediately.", cohort_added: "Subscription added to the pilot cohort.", cohort_removed: "Subscription removed from the pilot cohort." };
const errorMessages: Record<string, string> = { readiness_incomplete: "Pilot and live status require every readiness gate.", pause_reason_required: "Add a short incident or shutdown reason.", cohort_subscription_ineligible: "Only eligible assigned subscriptions for this provider can join its cohort." };

function related<T>(value: T | T[] | null) { return Array.isArray(value) ? value[0] || null : value; }
function readable(value: string) { return value.replaceAll("_", " "); }

export default async function VerifyProvidersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Supabase is not configured.");
  const [rolloutResult, cohortResult, subscriptionResult, clientResult] = await Promise.all([
    admin.from("uniplug_verify_provider_rollouts").select("provider,operational_status,authorization_status,authorization_model,authorization_reference,terms_review_status,code_semantics,incident_owner,support_runbook_reference,sender_allowlist_reviewed,parser_fixtures_reviewed,expiry_rules_reviewed,abuse_limits_reviewed,forbidden_code_classes_confirmed,support_runbook_reviewed,shutdown_reason,approved_at,updated_at").order("provider"),
    admin.from("uniplug_verify_provider_cohorts").select("id,provider,client_subscription_id,note,created_at").order("created_at", { ascending: false }),
    admin.from("client_subscriptions").select("id,client_id,status,account_reference,verify_enabled,service:client_services!client_subscriptions_service_id_fkey(name,verify_enabled,verify_provider)").order("updated_at", { ascending: false }).limit(1000),
    admin.from("clients").select("id,display_name,email").limit(2000)
  ]);
  const loadError = rolloutResult.error || cohortResult.error || subscriptionResult.error || clientResult.error;
  if (loadError) throw new Error(`VeriFy provider gates could not be loaded: ${loadError.message}`);

  const rolloutMap = new Map(((rolloutResult.data || []) as VerifyProviderRollout[]).map((row) => [row.provider, row]));
  const cohorts = (cohortResult.data || []) as Cohort[];
  const subscriptions = (subscriptionResult.data || []) as unknown as Subscription[];
  const subscriptionMap = new Map(subscriptions.map((row) => [row.id, row]));
  const clientMap = new Map(((clientResult.data || []) as Client[]).map((client) => [client.id, client]));
  const registry = listVerifyProviders();
  const configured = registry.filter((provider) => rolloutMap.has(provider.id));
  const readyCount = configured.filter((provider) => providerRolloutIsReady(rolloutMap.get(provider.id)!)).length;
  const liveCount = configured.filter((provider) => rolloutMap.get(provider.id)?.operational_status === "live").length;
  const pausedCount = configured.filter((provider) => rolloutMap.get(provider.id)?.operational_status === "paused").length;

  return (
    <section className="portal-page">
      <AdminPageHeader eyebrow="VeriFy" title="Provider rollout gates" description="Provider governance stays available without making the normal VeriFy operations page feel like a policy editor." actions={<Link className="button button-light" href="/admin/mailboxes">Back to VeriFy</Link>} />
      {query.success && successMessages[query.success] ? <p className="admin-notice">{successMessages[query.success]}</p> : null}
      {query.error && errorMessages[query.error] ? <p className="admin-notice error">{errorMessages[query.error]}</p> : null}

      <AdminMetricStrip items={[
        { label: "Reviewed providers", value: registry.length, detail: "code registry only" },
        { label: "Ready", value: readyCount, detail: "all gates passed", tone: readyCount === registry.length ? "good" : "warning" },
        { label: "Live", value: liveCount, detail: "eligible members" },
        { label: "Paused", value: pausedCount, detail: "shutdown enforced", tone: pausedCount ? "warning" : "good" }
      ]} />

      <AdminSection title="Providers" description="Open a provider only when governance, pilot or shutdown controls are needed.">
        {registry.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Provider</th><th>Operational</th><th>Readiness</th><th>Authorization</th><th>Terms</th><th>Pilot cohort</th><th>Manage</th></tr></thead><tbody>{registry.map((provider) => {
          const rollout = rolloutMap.get(provider.id);
          if (!rollout) return <tr key={provider.id}><td><strong>{provider.displayName}</strong><small>{provider.id}</small></td><td><AdminStatus value="disabled" label="Unconfigured" /></td><td><AdminStatus value="attention" label="Incomplete" /></td><td>—</td><td>—</td><td>0</td><td><span className="admin-row-subtext">Configure database first</span></td></tr>;
          const ready = providerRolloutIsReady(rollout);
          const providerCohorts = cohorts.filter((row) => row.provider === provider.id);
          const eligibleSubscriptions = subscriptions.filter((subscription) => {
            const service = related(subscription.service);
            return service?.verify_provider === provider.id && provider.isEligible({ status: subscription.status, capabilityEnabled: Boolean(service.verify_enabled && subscription.verify_enabled), hasAssignedAccount: Boolean(subscription.account_reference?.trim()) });
          });
          return <tr key={provider.id}>
            <td><strong>{provider.displayName}</strong><small>{provider.id}</small></td>
            <td><AdminStatus value={rollout.operational_status} /></td>
            <td><AdminStatus value={ready ? "healthy" : "attention"} label={ready ? "Passed" : "Incomplete"} /></td>
            <td>{readable(rollout.authorization_status)}</td>
            <td>{readable(rollout.terms_review_status)}</td>
            <td>{providerCohorts.length}</td>
            <td><AdminDrawer triggerLabel="Manage" triggerClassName="button button-light small" title={provider.displayName} eyebrow="Provider governance" description="Change rollout state, review activation gates and manage the pilot cohort.">
              <div className="admin-stack">
                {rollout.shutdown_reason ? <p className="admin-notice error">Shutdown note: {rollout.shutdown_reason}</p> : null}
                <form action={updateVerifyProviderGovernance} className="admin-form-clean">
                  <input name="provider" type="hidden" value={provider.id} />
                  <div className="admin-split-fields"><label>Operational status<select defaultValue={rollout.operational_status} name="operationalStatus"><option value="disabled">Disabled</option><option value="pilot">Pilot cohort only</option><option value="live">Live</option><option value="paused">Paused</option></select></label><label>Authorization<select defaultValue={rollout.authorization_status} name="authorizationStatus"><option value="pending">Pending</option><option value="approved">Approved</option><option value="revoked">Revoked</option></select></label></div>
                  <label>Terms review<select defaultValue={rollout.terms_review_status} name="termsReviewStatus"><option value="pending">Pending</option><option value="approved">Approved</option><option value="blocked">Blocked</option></select></label>
                  <label>Authorization model<textarea defaultValue={rollout.authorization_model} maxLength={1200} name="authorizationModel" required /></label>
                  <div className="admin-split-fields"><label>Authorization reference<input defaultValue={rollout.authorization_reference} maxLength={300} name="authorizationReference" required /></label><label>Incident owner<input defaultValue={rollout.incident_owner} maxLength={160} name="incidentOwner" required /></label></div>
                  <label>Allowed code semantics<textarea defaultValue={rollout.code_semantics} maxLength={600} name="codeSemantics" required /></label>
                  <label>Support runbook reference<input defaultValue={rollout.support_runbook_reference} maxLength={300} name="supportRunbookReference" required /></label>
                  <div className="admin-compact-card"><strong>Activation gates</strong><div className="admin-stack" style={{ marginTop: 10 }}><label className="check-label"><input defaultChecked={rollout.sender_allowlist_reviewed} name="senderAllowlistReviewed" type="checkbox" /> Sender allowlist reviewed</label><label className="check-label"><input defaultChecked={rollout.parser_fixtures_reviewed} name="parserFixturesReviewed" type="checkbox" /> Parser fixtures pass</label><label className="check-label"><input defaultChecked={rollout.expiry_rules_reviewed} name="expiryRulesReviewed" type="checkbox" /> Expiry rules reviewed</label><label className="check-label"><input defaultChecked={rollout.abuse_limits_reviewed} name="abuseLimitsReviewed" type="checkbox" /> Abuse limits reviewed</label><label className="check-label"><input defaultChecked={rollout.forbidden_code_classes_confirmed} name="forbiddenCodeClassesConfirmed" type="checkbox" /> Forbidden code classes confirmed</label><label className="check-label"><input defaultChecked={rollout.support_runbook_reviewed} name="supportRunbookReviewed" type="checkbox" /> Support runbook reviewed</label></div></div>
                  <button className="button button-dark" type="submit">Save governance</button>
                </form>

                <div className="admin-compact-card"><strong>Instant shutdown</strong><p>Pause this provider without affecting other VeriFy providers.</p><form action={pauseVerifyProvider} className="admin-form-clean" style={{ marginTop: 10 }}><input name="provider" type="hidden" value={provider.id} /><label>Reason<input maxLength={300} name="reason" placeholder="Incident or shutdown reason" required /></label><ConfirmSubmitButton className="button button-danger small" confirmation={`Pause ${provider.displayName} VeriFy now?`} type="submit">Pause now</ConfirmSubmitButton></form></div>

                <div className="admin-compact-card"><strong>Pilot cohort</strong><p>{providerCohorts.length} subscription{providerCohorts.length === 1 ? "" : "s"} stored for this provider.</p><form action={addVerifyProviderCohortMember} className="admin-form-clean" style={{ marginTop: 10 }}><input name="provider" type="hidden" value={provider.id} /><label>Eligible subscription<select name="subscriptionId" required><option value="">Select subscription</option>{eligibleSubscriptions.map((subscription) => { const client = clientMap.get(subscription.client_id); const service = related(subscription.service); return <option key={subscription.id} value={subscription.id}>{client?.display_name || client?.email || subscription.client_id} · {service?.name || provider.displayName} · {subscription.account_reference}</option>; })}</select></label><label>Safe note<input maxLength={240} name="note" placeholder="Internal pilot reason" /></label><button className="button button-light small" type="submit">Add to cohort</button></form>{providerCohorts.length ? <div className="admin-stack" style={{ marginTop: 12 }}>{providerCohorts.map((cohort) => { const subscription = subscriptionMap.get(cohort.client_subscription_id); const client = subscription ? clientMap.get(subscription.client_id) : null; return <div className="admin-attention-row" key={cohort.id} style={{ paddingInline: 0 }}><div><strong>{client?.display_name || client?.email || "Subscription"}</strong><p>{cohort.note || cohort.client_subscription_id}</p></div><form action={removeVerifyProviderCohortMember}><input name="cohortId" type="hidden" value={cohort.id} /><ConfirmSubmitButton className="button button-light small" confirmation="Remove this subscription from the pilot cohort?" type="submit">Remove</ConfirmSubmitButton></form></div>; })}</div> : null}</div>
              </div>
            </AdminDrawer></td>
          </tr>;
        })}</tbody></table></div> : <AdminEmptyState title="No reviewed providers" description="Only providers in the reviewed application registry can appear here." />}
      </AdminSection>
    </section>
  );
}
