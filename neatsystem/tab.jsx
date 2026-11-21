/**
 * NEATHUB as a NeatSystem tab — tab contract 1.
 * NeatSystem finds this file at systems/<folder>/neatsystem/tab.jsx, mounts
 * Root at /neathub/*, and reads neathub_api.profile_v1 for the profile page.
 * See NeatSystem src/core/tabs.ts.
 */
import { Boxes } from 'lucide-react'
import App from '../src/App.jsx'
import { mockProfile } from '../src/lib/store.js'
import '../src/styles/main.css'
import '../src/styles/tote.css'

// NEATHUB reads its own route from the hash (#/neathub/<path>), so the nested
// router path is ignored on purpose.
function Root({ host }) {
  return <App host={host} />
}

export default {
  contract: 1,
  id: 'neathub',
  label: 'NEATHUB',
  icon: Boxes,
  order: 40,
  dock: 4,
  Root,
  profile: { schema: 'neathub_api', fn: 'profile_v1' },
  mock: {
    profile: (user, ctx) => mockProfile(user, ctx),
    // same list as hub.register_permissions in supabase/migrations/0001_neathub.sql
    permissions: [
      { key: 'neathub.lead', label: 'עריכת ארגזים ב-NEATHUB (מה שמנטור סימן)', grp: 'NEATHUB', sort: 1, roles: ['team_lead', 'captain'] },
      { key: 'neathub.manage', label: 'ניהול NEATHUB: הכל, כולל מי עורך מה', grp: 'NEATHUB', sort: 2, roles: ['mentor', 'admin'] },
    ],
  },
}
