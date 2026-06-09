import { supabase } from './src/integrations/supabase/client';

async function testAuthStability() {
  console.log('Testing session retrieval...');
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Session retrieval error:', error.message);
    process.exit(1);
  }
  
  console.log('Session retrieved successfully:', !!session);
  if (session) {
    console.log('User ID:', session.user.id);
  } else {
    console.log('No session found (expected in clean environment)');
  }
  
  process.exit(0);
}

testAuthStability();
