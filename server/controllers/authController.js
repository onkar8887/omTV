const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const setTokenCookie = (res, token) => {
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    sameSite: 'lax', // Prevent CSRF attacks
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password, gender, country, state } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      authProvider: 'local',
      gender,
      country,
      state
    });

    if (user) {
      const token = generateToken(user._id);
      setTokenCookie(res, token);
      
      res.status(201).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        gender: user.gender,
        country: user.country,
        state: user.state,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });

    if (user && user.authProvider === 'local' && (await bcrypt.compare(password, user.password))) {
      const token = generateToken(user._id);
      setTokenCookie(res, token);

      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        gender: user.gender,
        country: user.country,
        state: user.state,
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
const getMe = async (req, res) => {
  try {
    let token;
    if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(200).json(null);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (user) {
      res.status(200).json(user);
    } else {
      // Clear cookie if user doesn't exist anymore (e.g. memory db wiped)
      res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
      res.status(200).json(null);
    }
  } catch (error) {
    // Invalid token
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json(null);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
const logoutUser = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Google login
// @route   POST /api/auth/google
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const { name, email, sub: googleId, picture: avatar } = ticket.getPayload();

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, login
      // Option: update their avatar/googleId if it wasn't a google auth before
      if (user.authProvider === 'local' && !user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google'; // convert to google auth or just link it
        await user.save();
      }
    } else {
      // User doesn't exist, create them
      user = await User.create({
        name,
        email,
        googleId,
        avatar,
        authProvider: 'google',
      });
    }

    const jwtToken = generateToken(user._id);
    setTokenCookie(res, jwtToken);

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      gender: user.gender,
      country: user.country,
      state: user.state,
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.gender = req.body.gender || user.gender;
    if (req.body.country !== undefined) user.country = req.body.country;
    if (req.body.state !== undefined) user.state = req.body.state;
    const updatedUser = await user.save();

    res.json({
      _id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      gender: updatedUser.gender,
      country: updatedUser.country,
      state: updatedUser.state,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  getMe,
  logoutUser,
  updateProfile,
};
