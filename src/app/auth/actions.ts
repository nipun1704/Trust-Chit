'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // Validate inputs
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?message=Email and password are required')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Login error:', error)
    redirect('/login?message=Invalid login credentials')
  }

  // Ensure user_profile exists so other features (invites, groups) work.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const normalizedEmail = (user.email ?? '').trim().toLowerCase() || `${user.id}@user.local`
      const nameFromMetadata =
        typeof (user.user_metadata as any)?.name === 'string'
          ? (user.user_metadata as any).name
          : undefined
      const nameFromEmail = normalizedEmail.includes('@')
        ? normalizedEmail.split('@')[0]
        : undefined

      await supabase
        .from('user_profile')
        .upsert(
          {
            user_id: user.id,
            email: normalizedEmail,
            name: nameFromMetadata || nameFromEmail || 'User',
            created_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
    }
  } catch (e) {
    // Don't block login if profile upsert fails; other actions will surface errors.
    console.warn('user_profile upsert on login failed:', e)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // Validate inputs
  const email = (formData.get('email') as string) || ''
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  const normalizedEmail = email.trim().toLowerCase()

  if (!email || !password) {
    redirect('/signup?message=Email and password are required')
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

  const emailRedirectTo = siteUrl ? `${siteUrl}/auth/confirm` : undefined

  // First, create the auth user
  const { data: authData, error: signupError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
      data: {
        name: name,
      }
    }
  })

  if (signupError) {
    console.error('Signup error:', signupError)
    if (signupError.message.includes('already registered')) {
      redirect('/signup?message=User already exists')
    } else if (signupError.message.includes('Password')) {
      redirect('/signup?message=Password is too short')
    } else {
      const msg =
        process.env.NODE_ENV === 'development'
          ? encodeURIComponent(signupError.message)
          : 'Error%20creating%20account'
      redirect(`/signup?message=${msg}`)
    }
  }

  if (authData.user) {
    // Then create the user profile
    const { error: profileError } = await supabase
      .from('user_profile')
      .insert({
        user_id: authData.user.id,
        name: name,
        email: normalizedEmail,
        created_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // We could handle this more gracefully, but for now we'll continue
      // since the auth user is created and they can try setting up their profile later
    }
  }

  // If email confirmation is disabled in Supabase, a session is returned and the user
  // can continue immediately.
  if (authData.session) {
    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  redirect('/login?message=Check your email to confirm your account')
}

export async function logout() {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Logout error:', error)
    }
    
    revalidatePath('/', 'layout')
    redirect('/login')
  } catch (error) {
    console.error('Unexpected logout error:', error)
    redirect('/login')
  }
}

export async function getUser() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    return null
  }
  
  return user
}
