import { NextRequest, NextResponse } from 'next/server';

// Helper function to format prompt for ChatGPT to preserve structure
function formatPromptForChatGPT(prompt: string): string {
  if (!prompt) return prompt;
  
  // Split the prompt into lines and process each line
  const lines = prompt.split('\n');
  const formattedLines = lines.map((line, index) => {
    const trimmedLine = line.trim();
    
    // Skip empty lines but preserve them
    if (!trimmedLine) {
      return '';
    }
    
    // Check if line appears to be a heading (starts with number, bullet, or is all caps)
    if (/^\d+\./.test(trimmedLine) || /^[-•*]/.test(trimmedLine)) {
      // It's already formatted as a list item
      return line;
    } else if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3) {
      // Likely a heading - make it bold
      return `**${trimmedLine}**`;
    } else if (index === 0 && lines.length > 1) {
      // First line is likely a title/heading
      return `**${trimmedLine}**`;
    }
    
    // Regular line - preserve as is
    return line;
  });
  
  return formattedLines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    // Generate HTML for any user without authentication or subscription checks
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
    if (!text || !backgroundColor || !textColor || !fontSize || padding === undefined || position === undefined || !aiProvider) {
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
        // Preserve text structure by adding formatting markers for ChatGPT
        const formattedPrompt = formatPromptForChatGPT(customPrompt);
        promptParams = `prompt=${encodeURIComponent(formattedPrompt)}`;
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
      message: 'HTML code generated successfully'
    });

  } catch (error) {
    console.error('Error generating HTML:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
