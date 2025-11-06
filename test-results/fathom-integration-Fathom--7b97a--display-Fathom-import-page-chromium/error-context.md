# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - generic [ref=e6]: Log in
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]: Email
        - textbox "Email" [ref=e10]:
          - /placeholder: Enter your email
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: Password
          - link "Forgot your password?" [ref=e14] [cursor=pointer]:
            - /url: /reset-password
        - textbox "Password" [ref=e15]:
          - /placeholder: Enter your password
      - button "Log in" [disabled]
      - paragraph [ref=e16]:
        - text: By continuing, you acknowledge AI Chat Interface's
        - link "Terms of Service" [ref=e17] [cursor=pointer]:
          - /url: /terms
        - text: .
    - paragraph [ref=e19]:
      - text: Don't have an account?
      - link "Create your account" [ref=e20] [cursor=pointer]:
        - /url: /register
  - region "Notifications alt+T"
```