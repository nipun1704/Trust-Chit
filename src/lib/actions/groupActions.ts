'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { 
  ApiResponse, 
  ApiSuccessResponse, 
  ChitGroup,
  ChitGroupWithCreator 
} from '@/types'

function toActionableDbError(message: string) {
  const msg = message || 'Database error'
  const lower = msg.toLowerCase()

  if (lower.includes('does not exist') || lower.includes('relation') || lower.includes('42p01')) {
    return 'Database tables are missing. In Supabase: SQL Editor → run `supabase/schema.sql` → retry.'
  }

  if (lower.includes('row level security') || lower.includes('row-level security') || lower.includes('42501')) {
    return 'Database blocked the action (RLS). For MVP: disable RLS on tables or add insert/select policies.'
  }

  if (lower.includes('violates foreign key constraint') || lower.includes('23503')) {
    return 'Database rejected the insert (foreign key). Ensure `user_profile` exists for your user and schema matches `supabase/schema.sql`.'
  }

  if (lower.includes('duplicate key value') || lower.includes('23505')) {
    return 'Duplicate data blocked the write. If this persists, clear test data or adjust unique constraints in Supabase.'
  }

  if (lower.includes('permission denied')) {
    return 'Database permissions blocked the action. Ensure grants exist for `anon`/`authenticated` (see `supabase/schema.sql`).'
  }

  return msg
}

async function ensureUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null; user_metadata?: any }
) {
  const { data: existing, error: existingError } = await supabase
    .from('user_profile')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(toActionableDbError(existingError.message))
  }

  if (existing?.user_id) return

  const email = user.email?.trim() || `${user.id}@user.local`
  const nameFromMetadata =
    typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined
  const nameFromEmail = email.includes('@') ? email.split('@')[0] : undefined
  const name = nameFromMetadata || nameFromEmail || 'User'

  const { error: upsertError } = await supabase
    .from('user_profile')
    .upsert(
      {
        user_id: user.id,
        email,
        name,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    throw new Error(toActionableDbError(upsertError.message))
  }
}

// Helper function to get current user
async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    throw new Error('Authentication required')
  }
  
  return user
}

// Helper function to validate positive numbers
function validatePositiveNumber(value: any, fieldName: string): number {
  const num = Number(value)
  if (isNaN(num) || num <= 0) {
    throw new Error(`${fieldName} must be a positive number`)
  }
  return num
}

export async function createGroup(formData: FormData): Promise<ApiResponse<ChitGroup>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    // Required by DB foreign keys: `chit_groups.created_by` and `group_members.user_id`
    // both reference `public.user_profile(user_id)`.
    await ensureUserProfile(supabase, user)

    // Validate and extract form data
    const name = formData.get('name') as string
    const description = formData.get('description') as string || null
    const monthlyContribution = validatePositiveNumber(
      formData.get('monthly_contribution'), 
      'Monthly contribution'
    )
    const totalMembers = validatePositiveNumber(
      formData.get('total_members'), 
      'Total members'
    )
    const durationMonths = validatePositiveNumber(
      formData.get('duration_months'), 
      'Duration months'
    )

    if (!name?.trim()) {
      return { data: null, error: 'Group name is required' }
    }

    // Insert group into chit_groups table
    const { data: groupData, error: groupError } = await supabase
      .from('chit_groups')
      .insert({
        name: name.trim(),
        description,
        monthly_contribution: monthlyContribution,
        total_members: totalMembers,
        duration_months: durationMonths,
        created_by: user.id,
        status: 'active'
      })
      .select()
      .single()

    if (groupError) {
      console.error('Group creation error:', groupError)
      return { data: null, error: toActionableDbError(groupError.message || 'Failed to create group') }
    }

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: groupData.id,
        user_id: user.id,
        role: 'admin'
      })

    if (memberError) {
      console.error('Member insertion error:', memberError)
      // Try to clean up the group if member insertion fails
      await supabase.from('chit_groups').delete().eq('id', groupData.id)
      return {
        data: null,
        error: toActionableDbError(memberError.message || 'Failed to create group membership'),
      }
    }

    // Revalidate relevant paths
    revalidatePath('/MyGroups')
    revalidatePath(`/GroupDetail/${groupData.id}`, 'page')

    return { data: groupData, error: null }
  } catch (error) {
    console.error('Create group error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to create group' 
    }
  }
}

export async function getMyGroups(): Promise<ApiResponse<ChitGroup[]>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    const { data, error } = await supabase
      .from('group_members')
      .select(`
        chit_groups!inner (
          id,
          name,
          description,
          monthly_contribution,
          total_members,
          duration_months,
          status,
          created_by,
          created_at
        )
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('Get my groups error:', error)
      return { data: null, error: 'Failed to fetch groups' }
    }

    // Extract and type the chit_groups data from the join result
    const groups = data
      ?.map((item: any) => item.chit_groups)
      .filter(Boolean) as ChitGroup[] || []

    return { data: groups, error: null }
  } catch (error) {
    console.error('Get my groups error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to fetch groups' 
    }
  }
}

export async function getGroupDetails(groupId: string): Promise<ApiResponse<ChitGroupWithCreator>> {
  try {
    const supabase = await createClient()
    
    if (!groupId?.trim()) {
      return { data: null, error: 'Group ID is required' }
    }

    // Get group details first
    const { data: groupData, error: groupError } = await supabase
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single()

    if (groupError) {
      console.error('Get group details error:', groupError)
      return { data: null, error: 'Failed to fetch group details' }
    }

    if (!groupData) {
      return { data: null, error: 'Group not found' }
    }

    // Get creator details from user_profile
    const { data: creatorData, error: creatorError } = await supabase
      .from('user_profile')
      .select('email, name')
      .eq('user_id', groupData.created_by)
      .single()

    // Format the response with creator details (if available)
    const groupWithCreator: ChitGroupWithCreator = {
      ...groupData,
      creator_email: creatorData?.email || undefined,
      creator_name: creatorData?.name || undefined
    }

    return { data: groupWithCreator, error: null }
  } catch (error) {
    console.error('Get group details error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to fetch group details' 
    }
  }
}

export async function updateGroup(
  groupId: string, 
  formData: FormData
): Promise<ApiResponse<ChitGroup>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!groupId?.trim()) {
      return { data: null, error: 'Group ID is required' }
    }

    // Check if user is admin of the group (application-level check)
    // Note: RLS will be the primary enforcer when implemented
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (memberError || memberData?.role !== 'admin') {
      return { data: null, error: 'Permission denied: Only group admin can update group' }
    }

    // Build update object from form data
    const updateData: any = {}
    
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const status = formData.get('status') as string

    if (name?.trim()) updateData.name = name.trim()
    if (description !== null) updateData.description = description
    if (status && ['pending', 'active', 'completed', 'cancelled'].includes(status)) {
      updateData.status = status
    }

    if (Object.keys(updateData).length === 0) {
      return { data: null, error: 'No valid fields to update' }
    }

    const { data, error } = await supabase
      .from('chit_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single()

    if (error) {
      console.error('Update group error:', error)
      return { data: null, error: 'Failed to update group' }
    }

    // Revalidate relevant paths
    revalidatePath('/MyGroups')
    revalidatePath(`/GroupDetail/${groupId}`, 'page')

    return { data, error: null }
  } catch (error) {
    console.error('Update group error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to update group' 
    }
  }
}

export async function deleteGroup(groupId: string): Promise<ApiSuccessResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!groupId?.trim()) {
      return { success: false, error: 'Group ID is required' }
    }

    // Check if user is admin/creator of the group (application-level check)
    // Note: RLS will be the primary enforcer when implemented
    const { data: groupData, error: groupError } = await supabase
      .from('chit_groups')
      .select('created_by')
      .eq('id', groupId)
      .single()

    if (groupError) {
      console.error('Group lookup error:', groupError)
      return { success: false, error: 'Group not found' }
    }

    if (groupData.created_by !== user.id) {
      return { success: false, error: 'Permission denied: Only group creator can delete group' }
    }

    // Delete the group (cascade deletes should handle related records)
    const { error: deleteError } = await supabase
      .from('chit_groups')
      .delete()
      .eq('id', groupId)

    if (deleteError) {
      console.error('Delete group error:', deleteError)
      return { success: false, error: 'Failed to delete group' }
    }

    // Revalidate relevant paths
    revalidatePath('/MyGroups')
    revalidatePath('/dashboard')

    return { success: true, error: null }
  } catch (error) {
    console.error('Delete group error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete group' 
    }
  }
}