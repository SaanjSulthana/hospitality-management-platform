# Responsive Design Quick Reference

## 🎯 Core Principles from Finance Page

### Mobile-First Strategy
Start with iPhone 6s (375px) and enhance for larger screens.

---

## 📱 Essential Patterns

### 0. Prerequisites (from index.css)
- **Safe Areas**: `.pt-safe` and `.pb-safe` rely on custom CSS variables.
- **Scrollbars**: Use `.no-scrollbar` (custom class), NOT `scrollbar-hide`.
- **Font**: **Barlow Condensed** must be imported.
- **Glass**: Use `.glass` or `.glass-card` utilities for best performance.

### 1. Container Setup
```tsx
<div className="w-full min-h-screen bg-gray-50 pt-safe pb-safe">
  <div className="space-y-6 pb-20 sm:pb-0">
    {/* Content - pb-20 for mobile sticky bar */}
  </div>
</div>
```

### 2. Responsive Padding
```tsx
// Card headers
className="px-3 pt-4 sm:px-6 sm:pt-6"

// Card content
className="px-2 py-2 sm:p-6"

// Containers
className="px-4 sm:px-6"
```

### 3. Stats Grid (Horizontal Scroll → Grid)
```tsx
<div className="flex overflow-x-auto pb-4 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:pb-0 snap-x snap-mandatory px-4 sm:px-0 -mx-4 sm:mx-0 no-scrollbar">
  <Card className="snap-center min-w-[85%] sm:min-w-0" />
</div>
```

### 4. Desktop Header (Hidden on Mobile)
```tsx
<div className="hidden sm:flex items-center justify-between sticky top-0 z-10 glass">
  {/* Desktop-only sticky header */}
</div>
```

### 5. Mobile Sticky Action Bar
```tsx
<div className="sm:hidden fixed bottom-0 inset-x-0 z-40 glass border-t px-3 py-3 pb-safe">
  <div className="flex gap-3">
    <Button className="flex-1 h-12">Action 1</Button>
    <Button className="flex-1 h-12">Action 2</Button>
  </div>
</div>
```

### 6. Touch-Friendly Inputs
```tsx
<Input className="h-12 text-base" />  // 48px height, 16px font
<Button className="h-11 w-11" />      // 44px minimum touch target
```

### 7. Responsive Form Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Field 1</Label>
    <Input className="h-12 text-base" />
  </div>
</div>
```

### 8. Modal/Dialog
```tsx
<DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col w-full mx-4">
  <DialogHeader className="pb-4">
    {/* Header */}
  </DialogHeader>
  <div className="flex-1 overflow-y-auto px-0">
    <div className="space-y-6 px-6">
      {/* Scrollable content */}
    </div>
  </div>
  <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
    {/* Sticky footer */}
  </DialogFooter>
</DialogContent>
```

---

## 🎨 Design Tokens

### Touch Targets
- **Minimum**: 44x44px (`h-11 w-11`)
- **Inputs**: 48px height (`h-12`)
- **Spacing**: 12px minimum between targets

### Font Sizes
- **Inputs**: `text-base` (16px) - prevents iOS zoom
- **Body**: `text-sm` (14px)
- **Headings**: `text-lg` to `text-xl`
- **Minimum**: `text-xs` (12px)

### Spacing Scale
- **xs**: `gap-1.5` (6px)
- **sm**: `gap-2` (8px)
- **md**: `gap-3` (12px)
- **lg**: `gap-4` (16px)
- **xl**: `gap-6` (24px)

### Border Radius
- **Cards**: `rounded-2xl` (16px)
- **Buttons**: `rounded-lg` (8px) or `rounded-full`
- **Badges**: `rounded-md` (6px)

### Shadows
- **Subtle**: `shadow-sm`
- **Medium**: `shadow-md`
- **Custom**: `shadow-[0_1px_3px_rgba(0,0,0,0.05)]`

---

## ✅ Mobile Checklist

- [ ] Touch targets ≥ 44x44px
- [ ] Input font size ≥ 16px
- [ ] Safe area padding (`pt-safe`, `pb-safe`)
- [ ] No sticky headers (natural scroll)
- [ ] Sticky action bar at bottom
- [ ] Horizontal scroll for wide content
- [ ] Adequate spacing (12px minimum)
- [ ] Transitions ≤ 200ms

---

## 🖥️ Desktop Enhancements

- [ ] Sticky header with actions
- [ ] Grid layouts (2-4 columns)
- [ ] Hover states
- [ ] Larger padding
- [ ] Multi-column forms

---

## 🎯 Breakpoints

| Screen | Width | Prefix | Use Case |
|--------|-------|--------|----------|
| Mobile | 0-639px | (none) | iPhone 6s+ |
| Tablet | 640px+ | `sm:` | Large phones, tablets |
| Desktop | 1024px+ | `lg:` | Laptops |
| Large | 1280px+ | `xl:` | Desktops |

---

## 🚀 Quick Copy-Paste Snippets

### Responsive Card
```tsx
<Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
  <CardHeader className="pb-3 px-3 pt-4 sm:px-6 sm:pt-6">
    <CardTitle className="text-lg">Title</CardTitle>
  </CardHeader>
  <CardContent className="px-2 py-2 sm:p-6">
    {/* Content */}
  </CardContent>
</Card>
```

### Transaction Card
```tsx
<div className="group relative bg-white rounded-2xl p-3 sm:p-4 transition-all duration-200 hover:bg-gray-50 border border-transparent hover:border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
  <div className="flex flex-col gap-4">
    {/* Header */}
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h4 className="text-lg font-bold text-gray-900">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {/* Badges */}
      </div>
    </div>
    
    {/* Content */}
    <div className="space-y-3">
      {/* Details */}
    </div>
    
    {/* Divider */}
    <div className="h-px w-full bg-gray-100/80 my-1"></div>
    
    {/* Footer */}
    <div className="flex items-center justify-between pt-1">
      <span className="text-2xl font-bold">{amount}</span>
      <div className="flex items-center gap-3">
        {/* Actions */}
      </div>
    </div>
  </div>
</div>
```

### Icon Button
```tsx
<Button
  size="icon"
  variant="outline"
  className="h-11 w-11 rounded-full border-gray-100 bg-white hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
>
  <Icon className="h-5 w-5" />
</Button>
```

### Status Badge
```tsx
<Badge className="bg-green-100 text-green-800 rounded-md px-2 py-0.5 font-normal text-xs uppercase tracking-wide border-0">
  Approved
</Badge>
```

---

## 🎨 Color System

### Status Colors
```tsx
// Success
className="bg-green-100 text-green-800"

// Warning
className="bg-yellow-100 text-yellow-800"

// Error
className="bg-red-100 text-red-800"

// Info
className="bg-blue-100 text-blue-800"
```

### Payment Modes
```tsx
// Cash
className="bg-green-100 text-green-800"

// Bank/UPI
className="bg-blue-100 text-blue-800"
```

---

## 🔍 Testing Devices

### Priority Devices
1. **iPhone 6s** (375px) - Minimum target
2. **iPhone 12/13/14** (390px) - Common
3. **iPhone 14 Pro Max** (430px) - Large phone
4. **iPad** (768px) - Tablet
5. **Desktop** (1280px+) - Desktop

### Test Both Orientations
- Portrait
- Landscape

---

## 💡 Pro Tips

1. **Always start mobile-first** - Add `sm:`, `lg:` prefixes to enhance
2. **Use `hidden sm:flex`** instead of `display: none` in media queries
3. **Safe areas** - Always use `pt-safe` and `pb-safe` for iOS
4. **Input font size** - Never below 16px to prevent iOS zoom
5. **Touch targets** - Minimum 44x44px for all interactive elements
6. **Peek effect** - Use `min-w-[85%]` on horizontal scrolls
7. **Snap scrolling** - Add `snap-x snap-mandatory` + `snap-center`
8. **Glassmorphism** - Use sparingly: `bg-white/90 backdrop-blur-sm`

---

## 📚 Related Files

- **Full Guide**: `.agent/responsive-design-guide.md`
- **Reference Implementation**: `frontend/pages/FinancePage.tsx`
- **Components**: `frontend/components/ui/`

---

## 🎓 Key Takeaways

✅ **Mobile-first approach** with progressive enhancement  
✅ **Touch-friendly** with 44px minimum targets  
✅ **Safe area support** for iOS devices  
✅ **Horizontal scrolling** for wide content on mobile  
✅ **Sticky action bar** at bottom on mobile  
✅ **No sticky headers** on mobile for natural scroll  
✅ **Grid layouts** on desktop for better space usage  
✅ **Consistent spacing** using Tailwind's scale  
✅ **Glassmorphism** for modern, premium feel  
✅ **Smooth transitions** (200ms max) for performance  

---

**Last Updated**: December 2025  
**Based on**: Finance Page Implementation (FinancePage.tsx)
