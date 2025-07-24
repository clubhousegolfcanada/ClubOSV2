# ClubOS Ticket System Update

## New Feature: Delete Tickets

### Overview
Added the ability for admins and operators to delete tickets from the Ticket Center.

### Changes Made

#### Backend (`/api/tickets/:id`)
- Added `DELETE` endpoint with role-based access control
- Only admins and operators can delete tickets
- Logs deletion activity with user info

#### Frontend (Ticket Center)
- Added "Delete Ticket" button in the ticket details panel
- Only visible to users with admin or operator roles
- Confirmation dialog to prevent accidental deletions
- Automatically refreshes ticket list after deletion

### Usage
1. Navigate to the Ticket Center
2. Select a ticket from the list
3. In the ticket details panel, scroll to the "Actions" section
4. Click "Delete Ticket" (only visible for admins/operators)
5. Confirm the deletion in the popup dialog

### Security
- Role-based access control (admin/operator only)
- Confirmation dialog prevents accidental deletions
- Deletion activity is logged with user information

### API Endpoint
```
DELETE /api/tickets/:id
Authorization: Bearer <token>
Roles: admin, operator
```

Response:
```json
{
  "success": true,
  "message": "Ticket deleted successfully",
  "data": { /* deleted ticket data */ }
}
```
