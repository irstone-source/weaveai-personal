<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { goto } from "$app/navigation";
  import { ArrowLeftIcon } from "$lib/icons/index.js";
</script>

<svelte:head>
  <title>Terms of Service - AI Models Platform</title>
  <meta
    name="description"
    content="Terms of Service for AI Models Platform. Review our terms and conditions for using our AI-powered services."
  />
</svelte:head>

<div class="container mx-auto p-6 max-w-4xl">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
    <p class="text-lg text-muted-foreground">
      Last updated: {new Date().toLocaleDateString()}
    </p>
  </div>

  <!-- Content -->
  <div class="prose prose-slate dark:prose-invert max-w-none markdown-content">
    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
      <p class="mb-4">
        By accessing and using AI Models Platform (the "Service"), you accept
        and agree to be bound by the terms and provision of this agreement. If
        you do not agree to abide by the above, please do not use this service.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">2. Description of Service</h2>
      <p class="mb-4">
        AI Models Platform provides access to multiple artificial intelligence
        models for text generation, image creation, video generation, and other
        AI-powered services. The Service includes both free and paid
        subscription tiers with varying usage limits and features.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        3. User Accounts and Registration
      </h2>
      <p class="mb-4">
        To access certain features of the Service, you must register for an
        account. You agree to:
      </p>
      <ul>
        <li>
          Provide accurate, current, and complete information during
          registration
        </li>
        <li>Maintain the security of your password and account</li>
        <li>Notify us immediately of any unauthorized use of your account</li>
        <li>Accept responsibility for all activities under your account</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">4. Acceptable Use Policy</h2>
      <p class="mb-4">You agree not to use the Service to:</p>
      <ul>
        <li>
          Generate content that is illegal, harmful, threatening, or abusive
        </li>
        <li>Create content that infringes on intellectual property rights</li>
        <li>Violate any applicable laws or regulations</li>
        <li>Attempt to reverse engineer or exploit the Service</li>
        <li>Share account credentials with others</li>
        <li>
          Use the Service for commercial purposes beyond your subscription
          limits
        </li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        5. Subscription and Payment Terms
      </h2>
      <p class="mb-4">
        Paid subscriptions are billed in advance on a monthly or yearly basis.
        You agree to:
      </p>
      <ul>
        <li>Pay all applicable fees for your chosen subscription plan</li>
        <li>Provide accurate billing information</li>
        <li>Notify us of any changes to your payment information</li>
      </ul>
      <p class="mb-4">
        Subscriptions will automatically renew unless cancelled before the
        renewal date. Refunds may be provided at our sole discretion.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">6. Usage Limits and Fair Use</h2>
      <p class="mb-4">
        Each subscription plan includes specific usage limits for text, image,
        and video generation. Excessive usage beyond reasonable limits may
        result in temporary service restrictions or account suspension.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
      <p class="mb-4">
        You retain ownership of content you input into the Service. AI-generated
        content created through the Service is provided to you under a
        non-exclusive license. The Service and its underlying technology remain
        the property of AI Models Platform and its licensors.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        8. Privacy and Data Protection
      </h2>
      <p class="mb-4">
        Your privacy is important to us. Please review our Privacy Policy, which
        also governs your use of the Service, to understand our practices
        regarding your personal information.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">9. Termination</h2>
      <p class="mb-4">
        We may terminate or suspend your account and access to the Service at
        our sole discretion, without prior notice, for conduct that violates
        these Terms of Service or is harmful to other users, us, or third
        parties.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
      <p class="mb-4">
        THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE
        MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES AND SHALL
        NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL
        DAMAGES.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
      <p class="mb-4">
        We reserve the right to modify these terms at any time. We will notify
        users of significant changes via email or through the Service. Continued
        use of the Service after changes constitutes acceptance of the new
        terms.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">12. Contact Information</h2>
      <p class="mb-4">
        If you have any questions about these Terms of Service, please contact
        us at:
      </p>
      <p class="mb-4">
        Email: legal@aimodelsplatform.com<br />
        Address: [Your Company Address]
      </p>
    </section>
  </div>
</div>
