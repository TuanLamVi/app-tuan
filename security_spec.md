# Security Specification for MyGroup

## Data Invariants
1. **Users**: Only the owner of a profile can write to it. Any authenticated user can read public profile info (displayName, photoURL).
2. **Groups**:
   - Only the owner or admins can update group details.
   - Anyone can create a group (they become the owner).
   - Reading group details is restricted to members.
3. **Memberships**:
   - Only admins/owners of a group can add/remove members.
   - Users can read their own memberships.
   - Membership ID follows the pattern `{uid}_{groupId}` for uniqueness.
4. **Funds**:
   - Only group admins/owners can create/update funds.
   - Members can read funds.
5. **Transactions**:
   - Only group members can create transactions.
   - Only group admins/owners can delete/update transactions (auditing).
   - Amount must be positive.
   - Type must be 'income' or 'expense'.

## The Dirty Dozen Payloads (to be blocked)
1. Creating a group with a different person as `ownerId`.
2. Updating a transaction in a group I'm not a member of.
3. Deleting my own membership to a group to escape 'admin' role while keeping 'owner' (role manipulation).
4. Injecting 2MB string into `note` field of a transaction (Resource Exhaustion).
5. Setting `amount` to negative in a transaction.
6. Reading someone else's PII (like `email` or `phoneNumber`) without being in the same group.
7. Overwriting `createdAt` timestamp.
8. Creating a transaction for a `fundId` that doesn't exist.
9. Modifying `totalFund` on a Group directly without a transaction (Relational Sync).
10. Impersonating another user in `createdBy`.
11. Bypassing `isValidId` with junk characters.
12. Updating `role` of yourself to 'owner' without being invited.
