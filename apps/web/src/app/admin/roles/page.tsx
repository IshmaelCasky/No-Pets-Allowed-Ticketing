import { PageHeader } from "../_components/page-header";
import { RolesClient } from "./_components/roles-client";

export default function RolesPage() {
  return (
    <div>
      <PageHeader
        title="Role Management"
        description="Define roles and the permissions they grant."
      />
      <RolesClient />
    </div>
  );
}
