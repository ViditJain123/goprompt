# Newsletter Button Generator

A modern, no-code HTML button generator built with Next.js that allows users to create customizable buttons that link to ChatGPT with custom prompts and search hints for newsletters, blogs, and websites without writing any code.

## Features

### 🎨 Visual Customization
- **Text**: Customize button text and font size
- **Colors**: Choose background and text colors with color pickers
- **Size & Shape**: Adjust padding, border radius, and border width
- **Live Preview**: See changes in real-time as you customize

### 🔧 Advanced Features
- **Search Toggle**: Enable/disable search functionality (adds `hints=true` parameter)
- **Custom Prompts**: Add custom prompts that get passed as URL parameters
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices

### 📋 Export & Copy
- **HTML Generation**: Automatically generates clean, production-ready HTML code
- **One-Click Copy**: Copy the generated HTML with a single click
- **Clipboard Integration**: Uses modern clipboard API for seamless copying

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd newsletterbutton
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Customize Your Button**:
   - Enter your desired button text
   - Adjust font size using the slider
   - Choose background and text colors
   - Modify padding, border radius, and border width
   - Enable search functionality if needed
   - Add a custom prompt if required

2. **Preview**: See your button in real-time in the preview panel

3. **Copy HTML**: Click the "Copy HTML Code" button to copy the generated HTML

4. **Use**: Paste the HTML code into your newsletter, blog, or website

## Generated HTML Structure

The application generates clean HTML with inline styles. The prompt parameter is properly encoded:
- Spaces are replaced with `+` for readability
- URLs within the prompt are properly encoded with `%` characters

```html
<a href="https://chatgpt.com?hints=search&prompt=Read+from+https%3A%2F%2Fdocs.privy.io%2Fbasics%2Freact%2Fsetup.md+so+I+can+ask+questions+about+it" 
   style="background-color: #3b82f6; color: #ffffff; font-size: 16px; 
          padding: 12px 24px; border-radius: 6px; border: 0px solid #000000; 
          cursor: pointer; text-decoration: none; display: inline-block; 
          font-family: Arial, sans-serif; transition: all 0.2s ease;">
   Your Button Text
</a>
```

### URL Parameters
- `hints=search`: Added when search functionality is enabled
- `prompt=value`: Added when a custom prompt is provided (spaces are encoded as `+`, URLs are properly encoded)

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Language**: TypeScript
- **State Management**: React Hooks

## Project Structure

```
src/
├── app/
│   ├── globals.css      # Global styles and custom CSS
│   ├── layout.tsx       # Root layout component
│   └── page.tsx         # Main button generator component
├── components/          # Reusable components (if any)
└── types/              # TypeScript type definitions (if any)
```

## Customization

### Adding New Features
The application is built with a modular structure. To add new customization options:

1. Add new properties to the `ButtonConfig` interface
2. Update the `generateHTML()` function to include new parameters
3. Add UI controls in the appropriate section
4. Update the preview styling

### Styling
The application uses Tailwind CSS for styling. Custom styles can be added to `globals.css` or using Tailwind's utility classes.

## Browser Support

- Chrome 88+
- Firefox 87+
- Safari 14+
- Edge 88+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and Tailwind CSS
