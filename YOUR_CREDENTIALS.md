# 🔐 Your WeaveAI Enterprise Credentials

**Created:** October 25, 2025

---

## 🎯 **Admin Login**

**URL:** http://localhost:5173/login

**Email:** `irstone@me.com`
**Password:** `WeaveAI2025!`

**Admin Dashboard:** http://localhost:5173/admin

---

## 📧 **Configure Resend Email (NEXT STEP)**

You mentioned you have a Resend API key. Here's how to add it:

### **Step 1: Add Your Resend API Key**

Open the `.env` file and replace this line:
```env
RESEND_API_KEY=YOUR_RESEND_API_KEY_HERE
```

With your actual key:
```env
RESEND_API_KEY=re_YOUR_ACTUAL_KEY_HERE
```

### **Step 2: Update Email Settings**

Also update these in `.env`:
```env
FROM_EMAIL=noreply@yourdomain.com  # Change to your domain
FROM_NAME=WeaveAI                  # Your company name
```

### **Step 3: Restart Dev Server**

After adding your Resend key:
```bash
# Stop the current server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### **Step 4: Test Email Features**

Once configured, these will work:
- ✅ Password reset emails
- ✅ Welcome emails
- ✅ Email verification

---

## 🤖 **AI Provider Keys (Already Configured)**

✅ **OpenRouter:** Configured
✅ **OpenAI:** Configured
✅ **Gemini:** Configured

These give you access to 65+ AI models!

---

## 💾 **Database**

**Provider:** Neon PostgreSQL
**Status:** ✅ Connected
**Tables:** 16 tables initialized

---

## 🚀 **Quick Actions**

### **Test Your Login**
```bash
1. Go to: http://localhost:5173/login
2. Email: irstone@me.com
3. Password: WeaveAI2025!
4. Click "Sign In"
```

### **Access Admin Dashboard**
```bash
1. Login first (see above)
2. Go to: http://localhost:5173/admin
3. Configure:
   - Site branding
   - Pricing plans
   - AI model settings
```

### **Test AI Chat**
```bash
1. Go to: http://localhost:5173/
2. Click "New chat"
3. Select a model (GPT-4, Claude, etc.)
4. Send a message!
```

---

## 📝 **Important Notes**

- **Password:** Write down `WeaveAI2025!` somewhere safe
- **Resend:** You can get a free API key at https://resend.com
- **Email Verification:** Currently SKIPPED for local dev (`SKIP_EMAIL_VERIFICATION=true`)
- **Admin Access:** You have full admin rights

---

## 🔄 **Change Password Later**

If you want to change your password to something else, run:
```bash
# Edit reset-password.mjs and change 'WeaveAI2025!' to your new password
DATABASE_URL="your-db-url" node reset-password.mjs
```

---

## 🎉 **You're All Set!**

Everything is configured and ready to use:
- ✅ Safari HTTPS issue fixed
- ✅ Database connected
- ✅ Admin account created
- ✅ Password set
- ✅ AI providers configured
- ⏳ Resend ready (just add your API key)

**Next:** Add your Resend API key to enable email features!
