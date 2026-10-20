import { PageHeader } from "../_components/page-header";
import { UsersClient } from "./_components/users-client";

export default function UsersPage() {
  return (
    <div>
      <PageHeader
        title="User Management"
        description="Search users, create staff, assign roles, and manage access."
      />
      <UsersClient />
    </div>
  );
}
