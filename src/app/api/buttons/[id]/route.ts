import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Button from '@/models/Button';

// GET /api/buttons/[id] - Get specific button
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const button = await Button.findOne({ 
      _id: id,
      userId: user._id 
    });

    if (!button) {
      return NextResponse.json({ error: 'Button not found' }, { status: 404 });
    }

    return NextResponse.json({ button });
  } catch (error) {
    console.error('Error fetching button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/buttons/[id] - Update button
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const button = await Button.findOne({ 
      _id: id,
      userId: user._id 
    });

    if (!button) {
      return NextResponse.json({ error: 'Button not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      name, text, backgroundColor, textColor, fontSize, padding, borderRadius, 
      borderWidth, borderColor, enableSearch, customPrompt, shadowColor, 
      shadowBlur, shadowOffsetX, shadowOffsetY, position, aiProvider, tags, isPublic 
    } = body;

    // Update allowed fields
    if (name !== undefined) button.name = name;
    if (text !== undefined) button.text = text;
    if (backgroundColor !== undefined) button.backgroundColor = backgroundColor;
    if (textColor !== undefined) button.textColor = textColor;
    if (fontSize !== undefined) button.fontSize = fontSize;
    if (padding !== undefined) button.padding = padding;
    if (borderRadius !== undefined) button.borderRadius = borderRadius;
    if (borderWidth !== undefined) button.borderWidth = borderWidth;
    if (borderColor !== undefined) button.borderColor = borderColor;
    if (enableSearch !== undefined) button.enableSearch = enableSearch;
    if (customPrompt !== undefined) button.customPrompt = customPrompt;
    if (shadowColor !== undefined) button.shadowColor = shadowColor;
    if (shadowBlur !== undefined) button.shadowBlur = shadowBlur;
    if (shadowOffsetX !== undefined) button.shadowOffsetX = shadowOffsetX;
    if (shadowOffsetY !== undefined) button.shadowOffsetY = shadowOffsetY;
    if (position !== undefined) button.position = position;
    if (aiProvider !== undefined) button.aiProvider = aiProvider;
    if (tags !== undefined) button.tags = tags;
    if (isPublic !== undefined) button.isPublic = isPublic;

    // Generate new HTML code
    button.htmlCode = button.generateHTML();

    await button.save();

    return NextResponse.json({
      message: 'Button updated successfully',
      button: {
        id: button._id,
        name: button.name,
        text: button.text,
        backgroundColor: button.backgroundColor,
        textColor: button.textColor,
        fontSize: button.fontSize,
        padding: button.padding,
        borderRadius: button.borderRadius,
        borderWidth: button.borderWidth,
        borderColor: button.borderColor,
        enableSearch: button.enableSearch,
        customPrompt: button.customPrompt,
        shadowColor: button.shadowColor,
        shadowBlur: button.shadowBlur,
        shadowOffsetX: button.shadowOffsetX,
        shadowOffsetY: button.shadowOffsetY,
        position: button.position,
        aiProvider: button.aiProvider,
        htmlCode: button.htmlCode,
        isPublic: button.isPublic,
        tags: button.tags,
        createdAt: button.createdAt,
        updatedAt: button.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/buttons/[id] - Delete button
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const button = await Button.findOne({ 
      _id: id,
      userId: user._id 
    });

    if (!button) {
      return NextResponse.json({ error: 'Button not found' }, { status: 404 });
    }

    // Delete the button
    await Button.deleteOne({ _id: id });

    // Decrement user's button count
    user.buttonCount = Math.max(0, user.buttonCount - 1);
    await user.save();

    return NextResponse.json({
      message: 'Button deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

