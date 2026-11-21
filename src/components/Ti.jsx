// The old Tabler icon font, mapped to NeatSystem's icon set (lucide).
import { ArrowLeft, ArrowRight, House, Info, Link, Lock, LogIn, Pencil, Plus, Search, Trash2, Upload, Users, Globe, X } from 'lucide-react'

const MAP = { 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'brand-google': LogIn, home: House, 'info-circle': Info, link: Link, lock: Lock, pencil: Pencil, plus: Plus, search: Search, trash: Trash2, upload: Upload, users: Users, world: Globe, x: X }
export default function Ti({ n, className, size = 18 }) {
  const I = MAP[n] ?? Info
  return <I className={className} size={size} aria-hidden="true" />
}
