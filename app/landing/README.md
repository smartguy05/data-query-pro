# DataQuery Pro Landing Page

This is the product landing page for DataQuery Pro, built using Next.js and matching the existing application's design system.

## Overview

The landing page showcases DataQuery Pro's key features and benefits to potential users. It's designed to convert visitors into users by clearly communicating the value proposition and providing easy access to the demo and GitHub repository.

## Features

- **Responsive Design**: Fully responsive layout that works on mobile, tablet, and desktop
- **Dark/Light Mode**: Theme toggle matching the main application's implementation
- **SEO Optimized**: Comprehensive meta tags and Open Graph support for social sharing
- **Matching Design**: Uses the exact same Tailwind configuration, CSS variables, and shadcn/ui components as the main app
- **Screenshot Showcase**: Features real screenshots from the `/screenshots` folder
- **Clear CTAs**: Prominent "Try Demo" and "View on GitHub" buttons throughout

## Sections

1. **Hero Section**: Tagline, description, and primary CTAs
2. **Feature Highlights**: 9 key features with icons and descriptions
3. **Screenshots Section**: 4 screenshot showcases with alternating layouts
4. **How It Works**: 4-step process explanation with visual flow
5. **Database Support**: Cards showing supported databases (PostgreSQL, MySQL, SQL Server, SQLite)
6. **Get Started**: Installation instructions for Docker and npm
7. **Final CTA**: Reinforcement of value proposition with repeated CTAs
8. **Footer**: Links to resources, community, and license information

## Accessing the Landing Page

The landing page is available at:
- Development: `http://localhost:3000/landing`
- Production: `https://yourdomain.com/landing`

## Design System

The landing page uses:
- Same Tailwind CSS configuration from `/tailwind.config.js`
- CSS variables from `/app/globals.css`
- shadcn/ui components from `/components/ui/`
- ThemeProvider and ThemeToggle from the main app
- Text gradient utilities (`.text-gradient`)

## Key Design Elements

### Color Scheme
- Primary: Blue gradient (blue-500 to purple-600)
- Uses CSS variables for theming: `--primary`, `--background`, `--foreground`, etc.
- Consistent dark mode implementation

### Typography
- Font sizes range from text-sm to text-7xl
- Uses font-bold for headings
- Muted text color for secondary content

### Components
- Cards with hover effects (`border-2 hover:border-primary/50`)
- Gradient backgrounds for sections
- Icon badges for section labels
- Responsive grid layouts

## Screenshots Used

The landing page features the following screenshots:
- `08-query-entered.png` - Natural language query input
- `09-query-generated.png` - Generated SQL query
- `11-query-results-chart.png` - Query results with charts
- `21-query-error-revise.png` - Self-correcting query errors

## Customization

### Updating Links
The placeholder demo URL can be updated by searching for:
- `href="/"` - Update to actual demo URL when available

### Updating Content
- Taglines and descriptions are in the JSX
- Feature descriptions can be modified in the features grid
- Installation commands are in the "Get Started" section

### Adding More Screenshots
Simply add more grid items to the screenshots section with the same pattern:
```tsx
<div className="grid md:grid-cols-2 gap-8 items-center">
  <div className="space-y-4">
    {/* Content */}
  </div>
  <Card className="overflow-hidden border-2">
    <Image src="/screenshots/..." alt="..." width={800} height={600} />
  </Card>
</div>
```

## SEO Metadata

The landing page includes comprehensive SEO metadata in `layout.tsx`:
- Title and description tags
- Keywords
- Open Graph tags for social sharing
- Twitter Card tags
- Robots meta for search engines

**Note**: Update the `metadataBase` URL in `layout.tsx` to your actual domain when deploying.

## Performance

The landing page is optimized for performance:
- Static generation (pre-rendered at build time)
- Optimized images using Next.js Image component
- Minimal JavaScript (only for theme toggle)
- Build size: ~13.4 kB

## Future Enhancements

Potential additions:
- Customer testimonials section
- Video demo/tutorial
- Feature comparison table
- Live demo with sample database
- Newsletter signup
- Blog/documentation links
- Pricing information (if applicable)

## Maintenance

When updating the main application's design system:
1. The landing page will automatically inherit changes from `tailwind.config.js`
2. CSS variable updates in `globals.css` will apply automatically
3. shadcn/ui component updates should be tested with the landing page
4. Always test dark/light mode after design changes
