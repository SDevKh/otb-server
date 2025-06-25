import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Use synchronous verification for simplicity
    const user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Log the decoded token
    console.log('Decoded token:', user);
    
    // Ensure userId is a string for consistent handling
    if (user.userId) {
      user.userId = String(user.userId);
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};