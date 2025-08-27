import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import Preset from '@/models/Preset';
import User from '@/models/User';

// GET /api/presets - Get all presets (default + user's custom + public)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // 'default', 'custom', 'public', or 'all'
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    let query: Record<string, unknown> = {};
    
    switch (category) {
      case 'default':
        query = { category: 'default' };
        break;
      case 'custom':
        if (!userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Find the user's MongoDB ObjectId from their Clerk ID
        const user = await User.findOne({ clerkId: userId });
        if (!user) {
          return NextResponse.json({ presets: [], pagination: { page, limit, total: 0, pages: 0 } });
        }
        query = { category: 'custom', userId: user._id };
        break;
      case 'public':
        query = { isPublic: true };
        break;
      default:
        // Get all: default presets + user's custom presets + public presets
        if (userId) {
          // Find the user's MongoDB ObjectId from their Clerk ID
          const userForAll = await User.findOne({ clerkId: userId });
          if (userForAll) {
            query = {
              $or: [
                { category: 'default' },
                { category: 'custom', userId: userForAll._id },
                { isPublic: true }
              ]
            };
          } else {
            query = {
              $or: [
                { category: 'default' },
                { isPublic: true }
              ]
            };
          }
        } else {
          query = {
            $or: [
              { category: 'default' },
              { isPublic: true }
            ]
          };
        }
    }

    const presets = await Preset.find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ category: 1, usageCount: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Preset.countDocuments(query);

    return NextResponse.json({
      presets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching presets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presets' },
      { status: 500 }
    );
  }
}

// POST /api/presets - Create a new custom preset
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user exists and can create more presets
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      description,
      isPublic = false,
      text,
      backgroundColor,
      textColor,
      fontSize,
      padding,
      borderRadius,
      borderWidth,
      borderColor,
      shadowColor,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      position,
      enableSearch,
      customPrompt,
      aiProvider,
      tags = [],
      thumbnail,
    } = body;

    // Validate required fields
    if (!name || !text) {
      return NextResponse.json(
        { error: 'Name and text are required' },
        { status: 400 }
      );
    }

    // Check if preset name already exists for this user
    const existingPreset = await Preset.findOne({
      name,
      userId: user._id,
      category: 'custom'
    });

    if (existingPreset) {
      return NextResponse.json(
        { error: 'A preset with this name already exists' },
        { status: 400 }
      );
    }

    const preset = new Preset({
      name,
      description,
      category: 'custom',
      userId: user._id,
      isPublic,
      text,
      backgroundColor: backgroundColor || '#3b82f6',
      textColor: textColor || '#ffffff',
      fontSize: fontSize || 16,
      padding: padding || 12,
      borderRadius: borderRadius || 6,
      borderWidth: borderWidth || 0,
      borderColor: borderColor || '#000000',
      shadowColor: shadowColor || '#000000',
      shadowBlur: shadowBlur || 4,
      shadowOffsetX: shadowOffsetX || 0,
      shadowOffsetY: shadowOffsetY || 2,
      position: position || 'center',
      enableSearch: enableSearch || false,
      customPrompt: customPrompt || '',
      aiProvider: aiProvider || 'chatgpt',
      tags,
      thumbnail,
    });

    await preset.save();

    return NextResponse.json(preset, { status: 201 });
  } catch (error) {
    console.error('Error creating preset:', error);
    return NextResponse.json(
      { error: 'Failed to create preset' },
      { status: 500 }
    );
  }
}
