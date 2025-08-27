import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/db';
import Preset from '@/models/Preset';
import User from '@/models/User';
import mongoose from 'mongoose';

// GET /api/presets/[id] - Get a specific preset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid preset ID' }, { status: 400 });
    }

    const preset = await Preset.findById(id)
      .populate('userId', 'firstName lastName email')
      .lean();

    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    // Increment usage count
    await Preset.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });

    return NextResponse.json(preset);
  } catch (error) {
    console.error('Error fetching preset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preset' },
      { status: 500 }
    );
  }
}

// PUT /api/presets/[id] - Update a preset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid preset ID' }, { status: 400 });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const preset = await Preset.findById(id);
    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    // Check if user owns this preset (only custom presets can be updated)
    if (preset.category !== 'custom' || !preset.userId?.equals(user._id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      isPublic,
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
      tags,
      thumbnail,
    } = body;

    // If name is being changed, check for conflicts
    if (name && name !== preset.name) {
      const existingPreset = await Preset.findOne({
        name,
        userId: user._id,
        category: 'custom',
        _id: { $ne: id }
      });

      if (existingPreset) {
        return NextResponse.json(
          { error: 'A preset with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Update preset
    const updatedPreset = await Preset.findByIdAndUpdate(
      id,
      {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(text !== undefined && { text }),
        ...(backgroundColor !== undefined && { backgroundColor }),
        ...(textColor !== undefined && { textColor }),
        ...(fontSize !== undefined && { fontSize }),
        ...(padding !== undefined && { padding }),
        ...(borderRadius !== undefined && { borderRadius }),
        ...(borderWidth !== undefined && { borderWidth }),
        ...(borderColor !== undefined && { borderColor }),
        ...(shadowColor !== undefined && { shadowColor }),
        ...(shadowBlur !== undefined && { shadowBlur }),
        ...(shadowOffsetX !== undefined && { shadowOffsetX }),
        ...(shadowOffsetY !== undefined && { shadowOffsetY }),
        ...(position !== undefined && { position }),
        ...(enableSearch !== undefined && { enableSearch }),
        ...(customPrompt !== undefined && { customPrompt }),
        ...(aiProvider !== undefined && { aiProvider }),
        ...(tags !== undefined && { tags }),
        ...(thumbnail !== undefined && { thumbnail }),
      },
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email');

    return NextResponse.json(updatedPreset);
  } catch (error) {
    console.error('Error updating preset:', error);
    return NextResponse.json(
      { error: 'Failed to update preset' },
      { status: 500 }
    );
  }
}

// DELETE /api/presets/[id] - Delete a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid preset ID' }, { status: 400 });
    }

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const preset = await Preset.findById(id);
    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    // Check if user owns this preset (only custom presets can be deleted)
    if (preset.category !== 'custom' || !preset.userId?.equals(user._id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await Preset.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Preset deleted successfully' });
  } catch (error) {
    console.error('Error deleting preset:', error);
    return NextResponse.json(
      { error: 'Failed to delete preset' },
      { status: 500 }
    );
  }
}
