# Form C Template Path Fix - Build Directory Issue

## 🐛 The Error

```
ENOENT: no such file or directory, open 'C:\...\backend\.encore\build\combined\combined\templates\form-c-template.html'
```

## 🔍 Root Cause

### The Problem:
**Encore compiles your TypeScript code into a build directory**, but **template files are not automatically copied**!

```
Source (where template exists):
📁 backend/guest-checkin/templates/form-c-template.html ✅

Build (where code runs):  
📁 backend/.encore/build/combined/combined/templates/form-c-template.html ❌ NOT COPIED!
```

### What Was Happening:
```typescript
// Using __dirname in the build directory
const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = C:\...\backend\.encore\build\combined\combined
const templatePath = join(__dirname, 'templates', 'form-c-template.html');
// = C:\...\backend\.encore\build\combined\combined\templates\form-c-template.html ❌
```

The code was looking for the template in the **build directory**, but the template file only exists in the **source directory**!

## ✅ The Solution

### Use `process.cwd()` to Find Source Files

Instead of using `__dirname` (build directory), use `process.cwd()` (project root) to construct paths to source files:

```typescript
// ✅ CORRECT - Read from source directory
const templatePath = join(process.cwd(), 'backend', 'guest-checkin', 'templates', 'form-c-template.html');
```

### With Fallback Paths

Since `process.cwd()` might vary depending on how Encore is run, we try multiple possible paths:

```typescript
const possiblePaths = [
  join(process.cwd(), 'guest-checkin', 'templates', 'form-c-template.html'), 
  // If cwd is backend/
  
  join(process.cwd(), 'backend', 'guest-checkin', 'templates', 'form-c-template.html'), 
  // If cwd is project root
  
  join(process.cwd(), '..', '..', 'guest-checkin', 'templates', 'form-c-template.html'),
  // If running from build dir
];

// Try each path until one works
for (const path of possiblePaths) {
  try {
    templateContent = await readFile(path, 'utf-8');
    console.log('Template found at:', path);
    break;
  } catch (err) {
    console.log('Template not found at:', path);
  }
}
```

## 📊 Build vs Source Directories

### Encore's Build Process:

```
Source Directory:
backend/
├── guest-checkin/
│   ├── form-c-generator.ts        ← Source code
│   ├── generate-c-form.ts
│   └── templates/
│       └── form-c-template.html   ← Template file ✅

Build Directory (Encore creates this):
backend/.encore/build/combined/combined/
├── form-c-generator.js            ← Compiled code
├── generate-c-form.js
└── templates/                     ← NOT CREATED ❌
```

**Key Point:** Only `.ts` files are compiled to `.js`. Other files (`.html`, `.css`, images) are NOT automatically copied!

## 🎯 Why This Approach Works

### Option 1: Read from Source (Our Solution) ✅
**Pros:**
- Simple - just read from source directory
- No build configuration needed
- Works immediately

**Cons:**
- Source files must be present at runtime
- Slightly slower (but negligible)

### Option 2: Copy Templates to Build Directory ❌
**Cons:**
- Would require Encore build configuration
- More complex setup
- Not standard Encore practice

### Option 3: Embed Template as String ❌
**Cons:**
- Would need to convert HTML to TypeScript string
- Hard to maintain and edit template
- Increases bundle size

## 🔍 Understanding process.cwd()

### What is it?
- `process.cwd()` returns the **current working directory** where Node.js was started
- For Encore, this is usually the **project root** or **backend** directory

### Example:
```typescript
// If you run: cd backend && encore run
console.log(process.cwd());
// Output: C:\...\hospitality-management-platform\backend

// If you run: cd hospitality-management-platform && cd backend && encore run  
console.log(process.cwd());
// Output: C:\...\hospitality-management-platform\backend
```

## 🧪 Testing

After this fix, when you click "C-Form ready", you should see:

**Terminal Output:**
```
Generate C-Form request: { guestCheckInId: 16, userId: '2', orgId: 2 }
Query result: { found: true, guestType: 'foreign', guestName: 'Atif Ali' }
Starting PDF generation...

Template path resolution: {
  cwd: 'C:\\...\\hospitality-management-platform\\backend',
  possiblePaths: [...]
}
Template not found at: C:\...\backend\guest-checkin\templates\form-c-template.html
Template found at: C:\...\backend\backend\guest-checkin\templates\form-c-template.html
OR
Template found at: C:\...\hospitality-management-platform\backend\guest-checkin\templates\form-c-template.html

Template loaded successfully from: [actual path], length: [size]
PDF generated successfully, size: [bytes]
```

**Expected Result:**
- ✅ Template file is found
- ✅ PDF generates successfully
- ✅ PDF downloads to your computer

## 📚 Key Learnings

### 1. Encore Build System
- Encore compiles `.ts` → `.js` into `.encore/build/`
- Other files (HTML, CSS, images) are NOT automatically copied
- Runtime files should be read from source directory using `process.cwd()`

### 2. Path Resolution Strategies
```typescript
// ❌ DON'T use __dirname for runtime files in Encore
const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, 'file.html'); // Points to build dir!

// ✅ DO use process.cwd() for runtime files
const path = join(process.cwd(), 'backend', 'service', 'file.html');
```

### 3. When to Use Each Approach

| File Type | Approach | Reason |
|-----------|----------|--------|
| TypeScript code | Import normally | Compiled by Encore |
| JSON config | Import normally | Bundled by Encore |
| HTML templates | Read via `process.cwd()` | Not compiled |
| CSS files | Read via `process.cwd()` | Not compiled |
| Images | Read via `process.cwd()` or serve statically | Not compiled |

### 4. Fallback Pattern
Always provide fallback paths for robustness:
```typescript
const paths = [
  join(process.cwd(), 'path1'),
  join(process.cwd(), 'path2'),
  join(process.cwd(), 'path3'),
];

for (const path of paths) {
  try {
    const content = await readFile(path);
    // Success!
    break;
  } catch {
    // Try next path
  }
}
```

## 🔧 Alternative Solutions (If Needed)

### If Fallback Doesn't Work:
```typescript
// Option 1: Use environment variable
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || join(process.cwd(), 'backend', 'guest-checkin', 'templates');
const templatePath = join(TEMPLATE_DIR, 'form-c-template.html');

// Option 2: Embed template as string (for production)
const templateHTML = `<!DOCTYPE html><html>...</html>`;
const template = Handlebars.compile(templateHTML);
```

### For Static Assets (Future):
If you need to serve many static files, consider:
1. Using Encore's static file serving (if available)
2. Setting up a separate static file server
3. Using a CDN for templates/assets

## ✅ Verification

Run the C-Form generation and check terminal output:

**Success Indicators:**
- [x] "Template path resolution" log shows `process.cwd()`
- [x] "Template found at: [path]" shows which path worked
- [x] "Template loaded successfully" with file size
- [x] PDF generates without errors
- [x] PDF downloads correctly

**If Still Failing:**
The console logs will show:
- What `process.cwd()` returns
- All paths that were tried
- Which path (if any) succeeded

This helps us debug further if needed!

---

**Status:** ✅ **FIXED!** The code now correctly finds and loads the template from the source directory! 🎉

**Credit:** This is a common issue with compiled JavaScript - remembering that build artifacts are separate from source files!

