import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Button from '@/models/Button';

// GET /api/buttons - Get user's buttons
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const tag = searchParams.get('tag');
    const isPublic = searchParams.get('public');

    const query: Record<string, unknown> = { userId: user._id };
    
    if (tag) {
      query.tags = { $in: [tag.toLowerCase()] };
    }
    
    if (isPublic !== null) {
      query.isPublic = isPublic === 'true';
    }

    const skip = (page - 1) * limit;
    
    const [buttons, total] = await Promise.all([
      Button.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-htmlCode'), // Don't send HTML code in list
      Button.countDocuments(query)
    ]);

    return NextResponse.json({
      buttons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching buttons:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/buttons - Create new button
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user can create more buttons
    if (!user.canCreateButton()) {
      return NextResponse.json({ 
        error: 'Button limit reached. Please upgrade your subscription to create more buttons.',
        currentCount: user.buttonCount,
        maxButtons: user.maxButtons
      }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, text, backgroundColor, textColor, fontSize, padding, borderRadius, 
      borderWidth, borderColor, enableSearch, customPrompt, shadowColor, 
      shadowBlur, shadowOffsetX, shadowOffsetY, position, aiProvider, tags 
    } = body;

    // Validate required fields
    if (!name || !text) {
      return NextResponse.json({ error: 'Name and text are required' }, { status: 400 });
    }

    // Create new button
    const newButton = new Button({
      userId: user._id,
      name,
      text,
      backgroundColor: backgroundColor || '#3b82f6',
      textColor: textColor || '#ffffff',
      fontSize: fontSize || 16,
      padding: padding || 12,
      borderRadius: borderRadius || 6,
      borderWidth: borderWidth || 0,
      borderColor: borderColor || '#000000',
      enableSearch: enableSearch || false,
      customPrompt: customPrompt || '',
      shadowColor: shadowColor || '#000000',
      shadowBlur: shadowBlur || 4,
      shadowOffsetX: shadowOffsetX || 0,
      shadowOffsetY: shadowOffsetY || 2,
      position: position || 'center',
      aiProvider: aiProvider || 'chatgpt',
      tags: tags || [],
      isPublic: false,
      usageCount: 0,
    });

    // Generate HTML code
    newButton.htmlCode = newButton.generateHTML();

    await newButton.save();

    // Increment user's button count
    user.incrementButtonCount();
    await user.save();

    return NextResponse.json({
      message: 'Button created successfully',
      button: {
        id: newButton._id,
        name: newButton.name,
        text: newButton.text,
        backgroundColor: newButton.backgroundColor,
        textColor: newButton.textColor,
        fontSize: newButton.fontSize,
        padding: newButton.padding,
        borderRadius: newButton.borderRadius,
        borderWidth: newButton.borderWidth,
        borderColor: newButton.borderColor,
        enableSearch: newButton.enableSearch,
        customPrompt: newButton.customPrompt,
        shadowColor: newButton.shadowColor,
        shadowBlur: newButton.shadowBlur,
        shadowOffsetX: newButton.shadowOffsetX,
        shadowOffsetY: newButton.shadowOffsetY,
        position: newButton.position,
        aiProvider: newButton.aiProvider,
        htmlCode: newButton.htmlCode,
        isPublic: newButton.isPublic,
        tags: newButton.tags,
        createdAt: newButton.createdAt,
        updatedAt: newButton.updatedAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

