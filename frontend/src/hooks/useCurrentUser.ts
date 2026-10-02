import { useQuery } from '@tanstack/react-query';
import { userService } from '../services/userService';

/** The signed-in person, read from their own profile (never a built-in name). */
export function useCurrentUser() {
  const { data } = useQuery({ queryKey: ['profile', localStorage.getItem('access_token')], queryFn: userService.getProfile, staleTime: 60_000 });
  const email: string = data?.email || '';
  const name: string = (data?.full_name || '').trim() || (email ? email.split('@')[0] : '');
  const initial = (name || email || '?').charAt(0).toUpperCase();
  return { name: name || 'Your account', email, initial, businessName: (data?.business_name as string) || '' };
}
