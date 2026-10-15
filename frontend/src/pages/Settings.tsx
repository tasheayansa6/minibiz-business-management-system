import { Icon } from "../components/icons";
import { PageHeader } from "../components/ui";

export function Settings() {
  return (
    <section>
      <PageHeader
        title="Settings"
        description="Workspace preferences are reserved for a later version of MiniBiz."
      />
      <article className="card settings-card">
        <div className="settings-icon">
          <Icon name="settings" />
        </div>
        <h2>This workspace</h2>
        <dl className="definition">
          <div>
            <dt>Application</dt>
            <dd>MiniBiz</dd>
          </div>
          <div>
            <dt>Currency display</dt>
            <dd>ETB</dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd>Products and sales from the MiniBiz API</dd>
          </div>
        </dl>
        <p className="settings-note">
          Profile, notification, and billing controls are not available in this version. Nothing on this page can be saved.
        </p>
      </article>
    </section>
  );
}
