import bcrypt from 'bcrypt';

async function testPassword() {
  const password = 'ClubhouseAdmin123!';
  const hash = '$2b$10$fq34c8GEHV2lhpVKMUnecOMrTiRezqlOum9its1zD3tq4pCBWk.w6';
  
  console.log('Testing password:', password);
  console.log('Against hash:', hash);
  
  try {
    const isValid = await bcrypt.compare(password, hash);
    console.log('Password valid:', isValid);
    
    // Also create a new hash to compare
    const newHash = await bcrypt.hash(password, 10);
    console.log('New hash:', newHash);
    
    const testNewHash = await bcrypt.compare(password, newHash);
    console.log('New hash valid:', testNewHash);
  } catch (error) {
    console.error('Error:', error);
  }
}

testPassword();
