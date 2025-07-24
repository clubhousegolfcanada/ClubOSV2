# 🔧 Fix User Management & Backup Issues

## Issues Found:

### 1. **Backup Feature Not Accessible**
- Backend has `/api/backup` endpoints but no frontend UI
- Endpoints exist:
  - `GET /api/backup/backup` - Download backup
  - `POST /api/backup/restore` - Restore from backup

### 2. **Phone Number Validation**
- In backend `auth.ts`, phone validation is `.optional()` but still validates format
- This causes issues when phone is empty

## Quick Fixes:

### 1. Fix Phone Number Validation (Backend)
Update `/ClubOSV1-backend/src/routes/auth.ts`:

```javascript
// Change this:
body('phone')
  .optional()
  .trim()
  .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
  .withMessage('Invalid phone number format')

// To this:
body('phone')
  .optional({ nullable: true, checkFalsy: true })
  .trim()
  .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
  .withMessage('Invalid phone number format')
```

### 2. Create User Management Page (Frontend)
Create `/ClubOSV1-frontend/src/pages/users.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { apiClient } from '@/utils/apiClient';
import { useAuthState } from '@/state/useStore';
import { Users, Download, Upload, UserPlus, Trash2, Edit } from 'lucide-react';

export default function UserManagement() {
  const router = useRouter();
  const { user } = useAuthState();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'operator',
    phone: ''
  });

  // Only admins can access
  useEffect(() => {
    if (user?.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await apiClient.get('/auth/users');
      setUsers(response.data.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      const response = await apiClient.get('/backup/backup');
      const backup = response.data.data;
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clubos-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Failed to create backup');
    }
  };

  const handleRestore = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        
        if (confirm('This will replace all current data. Are you sure?')) {
          await apiClient.post('/backup/restore', backup);
          alert('Restore successful');
          loadUsers();
        }
      } catch (error) {
        console.error('Restore failed:', error);
        alert('Failed to restore backup');
      }
    };
    input.click();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/auth/register', formData);
      setShowAddUser(false);
      setFormData({ email: '', password: '', name: '', role: 'operator', phone: '' });
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Delete this user?')) {
      try {
        await apiClient.delete(`/auth/users/${userId}`);
        loadUsers();
      } catch (error) {
        alert('Failed to delete user');
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <Head>
        <title>User Management - ClubOS</title>
      </Head>
      
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">User Management</h1>
            <div className="flex gap-2">
              <button onClick={handleBackup} className="btn btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" /> Backup
              </button>
              <button onClick={handleRestore} className="btn btn-secondary flex items-center gap-2">
                <Upload className="w-4 h-4" /> Restore
              </button>
              <button onClick={() => setShowAddUser(true)} className="btn btn-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add User
              </button>
            </div>
          </div>

          {/* User List */}
          <div className="card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-secondary)]">
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Phone</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-[var(--border-secondary)]">
                    <td className="p-4">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        u.role === 'admin' ? 'bg-red-600' : 
                        u.role === 'operator' ? 'bg-blue-600' : 'bg-green-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">{u.phone || '-'}</td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={u.id === user?.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add User Modal */}
          {showAddUser && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-[var(--bg-secondary)] p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Add New User</h2>
                <form onSubmit={handleAddUser}>
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        className="form-input"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                        minLength={8}
                      />
                    </div>
                    <div>
                      <label className="form-label">Role</label>
                      <select
                        className="form-input"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                      >
                        <option value="admin">Admin</option>
                        <option value="operator">Operator</option>
                        <option value="support">Support</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Phone (Optional)</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="+1234567890"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button type="submit" className="btn btn-primary flex-1">
                      Create User
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowAddUser(false)} 
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

### 3. Add Navigation Link
Update Navigation.tsx to include Users link for admins:

```typescript
const navItems = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] },
  { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] },
  { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] },
  { href: '/tickets', label: 'Ticket Center', roles: ['admin', 'operator'] },
  { href: '/users', label: 'Users', roles: ['admin'] }, // Add this line
].filter(item => hasAnyRole(user?.role, item.roles));
```

## Deploy Script
```bash
#!/bin/bash
cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Backend fix
cd ClubOSV1-backend
# Edit auth.ts to fix phone validation
# Add checkFalsy: true to phone validation

# Frontend fix  
cd ../ClubOSV1-frontend
# Create users.tsx page
# Update Navigation.tsx

# Commit and deploy
git add -A
git commit -m "fix: user management and phone validation

- Fixed phone number to be truly optional
- Added user management page with backup/restore
- Added Users link to navigation for admins"

git push
```