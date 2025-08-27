import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

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

    // Get user subscription details
    const subscriptionDetails = await user.getSubscriptionDetails();
    
    // Check if user is on free plan
    if (subscriptionDetails.plan === 'free') {
      return NextResponse.json({ 
        error: 'Copy feature is not available on the free plan',
        requiresUpgrade: true,
        userPlan: 'free'
      }, { status: 403 });
    }

    // If user has premium plan, generate and return HTML
    const requestData = await request.json();
    const {
      text,
      backgroundColor,
      textColor,
      fontSize,
      padding,
      borderRadius,
      borderWidth,
      borderColor,
      enableSearch,
      customPrompt,
      shadowColor,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      position,
      aiProvider
    } = requestData;

    // Validate required fields
    if (!text || !backgroundColor || !textColor || !fontSize || !padding || position === undefined || !aiProvider) {
      return NextResponse.json({ error: 'Missing required button configuration' }, { status: 400 });
    }

    // Generate HTML code server-side
    const buttonStyle = `
      background-color: ${backgroundColor};
      color: ${textColor};
      font-size: ${fontSize}px;
      padding: ${padding}px ${padding * 2}px;
      border-radius: ${borderRadius}px;
      border: ${borderWidth}px solid ${borderColor};
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      font-family: Arial, sans-serif;
      transition: all 0.2s ease;
      box-shadow: ${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor};
    `;

    const searchParams = enableSearch ? 'hints=search' : '';
    
    let promptParams = '';
    if (customPrompt) {
      if (aiProvider === 'chatgpt') {
        promptParams = `prompt=${encodeURIComponent(customPrompt)}`;
      } else {
        promptParams = `q=${encodeURIComponent(customPrompt)}`;
      }
    }
    
    const params = [searchParams, promptParams].filter(Boolean).join('&');
    
    let url = '';
    if (aiProvider === 'chatgpt') {
      url = params ? `https://chatgpt.com?${params}` : 'https://chatgpt.com';
    } else {
      url = params ? `https://claude.ai/new?${params}` : 'https://claude.ai/new';
    }

    let wrapperStyle = '';
    if (position === 'center') {
      wrapperStyle = 'text-align: center;';
    } else if (position === 'right') {
      wrapperStyle = 'text-align: right;';
    } else {
      wrapperStyle = 'text-align: left;';
    }

    const htmlCode = `<div style="${wrapperStyle}"><a href="${url}" style="${buttonStyle}">${text}</a></div>`;

    return NextResponse.json({
      success: true,
      htmlCode,
      userPlan: subscriptionDetails.plan,
      message: 'HTML code generated successfully'
    });

  } catch (error) {
    console.error('Error generating HTML:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
