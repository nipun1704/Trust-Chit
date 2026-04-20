'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Member, MemberWithUser, ActionResponse } from '@/types';
import { createInvitation } from '@/lib/actions/notificationActions';

/**
 * Invite a member to join a group
 */
export async function inviteMemberToGroup(
  groupId: string,
  email: string
): Promise<ActionResponse<{ invitationId: string }>> {
  try {
    const supabase = await createClient();

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return { success: false, error: 'Email is required' };
    }
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if the current user is an admin of the group
    const { data: currentMember, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !currentMember) {
      return { success: false, error: 'You are not a member of this group' };
    }

    if (currentMember.role !== 'admin') {
      return { success: false, error: 'Only group admins can invite members' };
    }

    // Check if user with this email exists
    const { data: targetUser, error: userError } = await supabase
      .from('user_profile')
      .select('user_id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('User lookup error:', userError);
      return { success: false, error: userError.message || 'Failed to lookup user' };
    }

    if (!targetUser) {
      return {
        success: false,
        error:
          'User with this email does not exist (they must sign up and log in once so their profile is created).',
      };
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', targetUser.user_id)
      .single();

    if (existingMember) {
      return { success: false, error: 'User is already a member of this group' };
    }

    // Create invitation notification (do not add as member yet)
    const notificationRes = await createInvitation(groupId, targetUser.user_id);
    if (!notificationRes.success) {
      return { success: false, error: notificationRes.error || 'Failed to send invitation notification' };
    }

    revalidatePath(`/GroupDetail/${groupId}`);
    return { 
      success: true, 
      data: { invitationId: notificationRes.data?.id || 'unknown' },
      message: 'Invitation sent successfully'
    };
  } catch (error) {
    console.error('Error inviting member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: string): Promise<ActionResponse<MemberWithUser[]>> {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if the current user is a member of the group
    const { data: currentMember, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !currentMember) {
      return { success: false, error: 'You are not a member of this group' };
    }

    // Get all members with user details
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select(`
        *,
        profile:user_profile(
          user_id,
          name,
          email
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (membersError) {
      return { success: false, error: 'Failed to fetch group members' };
    }

    // Transform the data to match our type
    const transformedMembers = (members || []).map(member => ({
      id: member.id,
      group_id: member.group_id,
      user_id: member.user_id,
      role: member.role,
      status: 'active' as const,
      created_at: member.created_at,
      updated_at: member.updated_at,
      user: {
        id: member.profile.user_id,
        full_name: member.profile.name,
        email: member.profile.email
      }
    }));

    return { 
      success: true, 
      data: transformedMembers,
      message: 'Members fetched successfully'
    };
  } catch (error) {
    console.error('Error fetching group members:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Remove a member from a group
 */
export async function removeMemberFromGroup(
  groupId: string,
  memberId: string
): Promise<ActionResponse<{ removedMemberId: string }>> {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if the current user is an admin of the group
    const { data: currentMember, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !currentMember) {
      return { success: false, error: 'You are not a member of this group' };
    }

    if (currentMember.role !== 'admin') {
      return { success: false, error: 'Only group admins can remove members' };
    }

    // Get the member to be removed
    const { data: memberToRemove, error: memberToRemoveError } = await supabase
      .from('group_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('group_id', groupId)
      .single();

    if (memberToRemoveError || !memberToRemove) {
      return { success: false, error: 'Member not found' };
    }

    // Prevent removing another admin
    if (memberToRemove.role === 'admin' && memberToRemove.user_id !== user.id) {
      return { success: false, error: 'Cannot remove another admin from the group' };
    }

    // Remove the member
    const { error: removeError } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId)
      .eq('group_id', groupId);

    if (removeError) {
      return { success: false, error: 'Failed to remove member' };
    }

    revalidatePath(`/GroupDetail/${groupId}`);
    return { 
      success: true, 
      data: { removedMemberId: memberId },
      message: 'Member removed successfully'
    };
  } catch (error) {
    console.error('Error removing member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update a member's role in a group
 */
export async function updateMemberRole(
  groupId: string,
  memberId: string,
  newRole: 'admin' | 'member'
): Promise<ActionResponse<Member>> {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if the current user is an admin of the group
    const { data: currentMember, error: memberError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !currentMember) {
      return { success: false, error: 'You are not a member of this group' };
    }

    if (currentMember.role !== 'admin') {
      return { success: false, error: 'Only group admins can update member roles' };
    }

    // Update the member's role
    const { data: updatedMember, error: updateError } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('group_id', groupId)
      .select('*')
      .single();

    if (updateError || !updatedMember) {
      return { success: false, error: 'Failed to update member role' };
    }

    // Transform to match our Member type
    const transformedMember: Member = {
      id: updatedMember.id,
      group_id: updatedMember.group_id,
      user_id: updatedMember.user_id,
      role: updatedMember.role,
      status: 'active',
      joined_at: updatedMember.joined_at,
      created_at: updatedMember.created_at || updatedMember.joined_at,
      updated_at: updatedMember.updated_at || new Date().toISOString()
    };

    revalidatePath(`/GroupDetail/${groupId}`);
    return { 
      success: true, 
      data: transformedMember,
      message: `Member role updated to ${newRole}`
    };
  } catch (error) {
    console.error('Error updating member role:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Leave a group (for non-admin members)
 */
export async function leaveGroup(groupId: string): Promise<ActionResponse<{ leftGroup: boolean }>> {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get the current member
    const { data: currentMember, error: memberError } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !currentMember) {
      return { success: false, error: 'You are not a member of this group' };
    }

    // Prevent admin from leaving if they're the only admin
    if (currentMember.role === 'admin') {
      const { data: adminCount, error: adminCountError } = await supabase
        .from('group_members')
        .select('id', { count: 'exact' })
        .eq('group_id', groupId)
        .eq('role', 'admin');

      if (adminCountError || (adminCount && adminCount.length <= 1)) {
        return { success: false, error: 'Cannot leave group as the only admin. Transfer ownership first.' };
      }
    }

    // Remove the member
    const { error: removeError } = await supabase
      .from('group_members')
      .delete()
      .eq('id', currentMember.id);

    if (removeError) {
      return { success: false, error: 'Failed to leave group' };
    }

    revalidatePath('/MyGroups');
    return { 
      success: true, 
      data: { leftGroup: true },
      message: 'Successfully left the group'
    };
  } catch (error) {
    console.error('Error leaving group:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all members across all groups the current user is part of
 */
export async function getAllUserMembers(): Promise<ActionResponse<MemberWithUser[]>> {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get all groups the user is a member of
    const { data: userGroups, error: groupsError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (groupsError) {
      return { success: false, error: 'Failed to fetch user groups' };
    }

    if (!userGroups || userGroups.length === 0) {
      return { success: true, data: [] };
    }

    const groupIds = userGroups.map(group => group.group_id);

    // Get all members from these groups with user details
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select(`
        *,
        user_profile!group_members_user_id_fkey (
          user_id,
          name,
          email
        ),
        chit_groups!group_members_group_id_fkey (
          name
        )
      `)
      .in('group_id', groupIds)
      .order('joined_at', { ascending: true });

    if (membersError) {
      return { success: false, error: 'Failed to fetch members' };
    }

    // Transform the data to match our type and remove duplicates
    const memberMap = new Map();
    
    (members || []).forEach(member => {
      const userId = member.user_id;
      if (!memberMap.has(userId)) {
        memberMap.set(userId, {
          id: member.id,
          group_id: member.group_id,
          user_id: member.user_id,
          role: member.role,
          status: 'active' as const,
          joined_at: member.joined_at,
          created_at: member.created_at || member.joined_at,
          updated_at: member.updated_at || member.joined_at,
          user: {
            id: member.user_profile.user_id,
            full_name: member.user_profile.name,
            email: member.user_profile.email
          },
          group_name: member.chit_groups.name
        });
      }
    });

    const uniqueMembers = Array.from(memberMap.values());

    return { 
      success: true, 
      data: uniqueMembers,
      message: 'Members fetched successfully'
    };
  } catch (error) {
    console.error('Error fetching all user members:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get member payment status across all groups
 */
export async function getMemberPaymentStatus(
  userId: string
): Promise<ActionResponse<{ status: 'Paid' | 'Pending' | 'Overdue'; lastPaymentDate?: string }>> {
  try {
    const supabase = await createClient();
    
    // Get user's recent payments
    const { data: payments, error } = await supabase
      .from('payments')
      .select('status, paid_at, created_at')
      .eq('user_id', userId)
      .eq('type', 'contribution')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return { success: false, error: 'Failed to fetch payment status' };
    }

    if (!payments || payments.length === 0) {
      return { 
        success: true, 
        data: { status: 'Pending' }
      };
    }

    // Determine status based on recent payments
    const completedPayments = payments.filter(p => p.status === 'completed');
    const pendingPayments = payments.filter(p => p.status === 'pending');
    const failedPayments = payments.filter(p => p.status === 'failed');

    let status: 'Paid' | 'Pending' | 'Overdue' = 'Pending';
    let lastPaymentDate: string | undefined;

    if (completedPayments.length > 0) {
      status = 'Paid';
      lastPaymentDate = completedPayments[0].paid_at;
    } else if (pendingPayments.length > 0) {
      status = 'Pending';
    } else if (failedPayments.length > 0) {
      // Check if failed payment is recent (within last 7 days)
      const recentFailed = failedPayments.find(p => {
        const failDate = new Date(p.created_at);
        const daysDiff = (Date.now() - failDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });
      status = recentFailed ? 'Overdue' : 'Pending';
    }

    return { 
      success: true, 
      data: { status, lastPaymentDate }
    };
  } catch (error) {
    console.error('Error getting member payment status:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Accept invitation: add user as member if not already
 */
export async function acceptGroupInvitation(groupId: string): Promise<ActionResponse<{ joined: boolean }>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Authentication required' };
    }
    // Check if already a member
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();
    if (existingMember) {
      return { success: true, data: { joined: false }, message: 'Already a member' };
    }
    // Add as member
    const { error: addError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: user.id, role: 'member' });
    if (addError) {
      return { success: false, error: 'Failed to join group' };
    }
    revalidatePath(`/GroupDetail/${groupId}`);
    revalidatePath('/MyGroups');
    return { success: true, data: { joined: true }, message: 'Joined group successfully' };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}