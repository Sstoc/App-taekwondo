import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'

export default function AuthInitializer() {
  const { setUser, setProfile } = useAppStore()
  const navigate = useNavigate()

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (data) {
      setProfile(data)
      return data
    }
    // Create default alumno profile
    const { data: newProfile } = await supabase
      .from('profiles')
      .upsert({ id: userId, role: 'alumno' })
      .select()
      .single()
    setProfile(newProfile)
    return newProfile
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const profile = await fetchProfile(session.user.id)
        if (window.location.pathname === '/' || window.location.pathname === '/login') {
          navigate(profile?.role === 'admin' ? '/admin/dashboard' : '/portal/status')
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}
