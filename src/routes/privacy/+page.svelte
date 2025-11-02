<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { goto } from "$app/navigation";
  import { ArrowLeftIcon } from "$lib/icons/index.js";
</script>

<svelte:head>
  <title>Privacy Policy - AI Models Platform</title>
  <meta
    name="description"
    content="Privacy Policy for AI Models Platform. Learn how we collect, use, and protect your personal information."
  />
</svelte:head>

<div class="container mx-auto p-6 max-w-4xl">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
    <p class="text-lg text-muted-foreground">
      Last updated: {new Date().toLocaleDateString()}
    </p>
  </div>

  <!-- Content -->
  <div class="prose prose-slate dark:prose-invert max-w-none markdown-content">
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">1. Introduction</h2>
      <p class="mb-4">
        AI Models Platform ("we," "our," or "us") is committed to protecting
        your privacy. This Privacy Policy explains how we collect, use,
        disclose, and safeguard your information when you use our AI-powered
        services.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">2. Information We Collect</h2>

      <h3 class="text-xl font-semibold mb-3">Personal Information</h3>
      <p class="mb-4">When you create an account, we collect:</p>
      <ul>
        <li>Email address and password</li>
        <li>Profile information you choose to provide</li>
        <li>Billing information for paid subscriptions</li>
        <li>Communication preferences</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Usage Information</h3>
      <p class="mb-4">We automatically collect:</p>
      <ul>
        <li>Chat messages and AI interactions</li>
        <li>Generated content (images, videos, text)</li>
        <li>Usage statistics and analytics</li>
        <li>Device and browser information</li>
        <li>IP address and location data</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        3. How We Use Your Information
      </h2>
      <p class="mb-4">We use your information to:</p>
      <ul>
        <li>Provide and maintain the AI Models Platform service</li>
        <li>Process your transactions and manage subscriptions</li>
        <li>Improve our AI models and service quality</li>
        <li>Communicate with you about service updates and support</li>
        <li>Ensure compliance with our Terms of Service</li>
        <li>Prevent fraud and abuse</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        4. Information Sharing and Disclosure
      </h2>

      <h3 class="text-xl font-semibold mb-3">Third-Party Service Providers</h3>
      <p class="mb-4">
        We share information with trusted partners who help us operate our
        service:
      </p>
      <ul>
        <li>AI model providers (OpenAI, Google, Anthropic, etc.)</li>
        <li>Payment processors (Stripe)</li>
        <li>Cloud storage providers (Cloudflare)</li>
        <li>Analytics and monitoring services</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Legal Requirements</h3>
      <p class="mb-4">
        We may disclose your information if required by law or to protect our
        rights, your safety, or the safety of others.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">5. Data Security</h2>
      <p class="mb-4">
        We implement appropriate security measures to protect your information:
      </p>
      <ul>
        <li>Encryption of sensitive data in transit and at rest</li>
        <li>Regular security audits and monitoring</li>
        <li>Access controls and authentication</li>
        <li>Secure data centers and infrastructure</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">6. Data Retention</h2>
      <p class="mb-4">
        We retain your personal information only for as long as necessary to
        provide our services and fulfill the purposes outlined in this policy.
        Chat history and generated content are stored until you delete them or
        close your account.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">7. Your Rights and Choices</h2>
      <p class="mb-4">You have the right to:</p>
      <ul>
        <li>Access and update your personal information</li>
        <li>Delete your account and associated data</li>
        <li>Opt out of marketing communications</li>
        <li>Export your data</li>
        <li>Request correction of inaccurate information</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">8. Cookies and Tracking</h2>
      <p class="mb-4">
        We use cookies and similar technologies to enhance your experience,
        analyze usage, and provide personalized content. You can control cookie
        settings through your browser preferences.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        9. International Data Transfers
      </h2>
      <p class="mb-4">
        Your information may be transferred to and processed in countries other
        than your country of residence. We ensure appropriate safeguards are in
        place to protect your data during international transfers.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
      <p class="mb-4">
        Our service is not intended for children under 13 years of age. We do
        not knowingly collect personal information from children under 13. If
        you believe we have collected information from a child, please contact
        us immediately.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        11. Changes to This Privacy Policy
      </h2>
      <p class="mb-4">
        We may update this Privacy Policy from time to time. We will notify you
        of any material changes by posting the new policy on this page and
        updating the "Last updated" date.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">12. Contact Us</h2>
      <p class="mb-4">
        If you have any questions about this Privacy Policy or our data
        practices, please contact us at:
      </p>
      <p class="mb-4">
        Email: privacy@aimodelsplatform.com<br />
        Address: [Your Company Address]<br />
        Phone: [Your Contact Number]
      </p>

      <h3 class="text-xl font-semibold mb-3">Data Protection Officer</h3>
      <p class="mb-4">
        For EU residents, you can contact our Data Protection Officer at:
        dpo@aimodelsplatform.com
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">13. Regional Privacy Rights</h2>

      <h3 class="text-xl font-semibold mb-3">European Union (GDPR)</h3>
      <p class="mb-4">
        If you are located in the EU, you have additional rights under the
        General Data Protection Regulation, including the right to data
        portability, the right to be forgotten, and the right to object to
        processing.
      </p>

      <h3 class="text-xl font-semibold mb-3">California (CCPA)</h3>
      <p class="mb-4">
        California residents have specific rights regarding their personal
        information, including the right to know what personal information is
        collected and the right to request deletion of personal information.
      </p>
    </section>
  </div>
</div>
