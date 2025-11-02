<script lang="ts">
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { getContext } from "svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as NavigationMenu from "$lib/components/ui/navigation-menu/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Accordion from "$lib/components/ui/accordion/index.js";
  import Logo from "$lib/components/Logo.svelte";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import { isInIframe, breakOutToPath } from "$lib/utils/codecanyon-detection.js";

  // Get settings from context (provided by layout) - same pattern as index page
  const settingsState = getContext<SettingsState>("settings");

  // Icons
  import {
    SparkleIcon,
    ImageIcon,
    VideoIcon,
    MessageCircleIcon,
    ShieldIcon,
    ArrowRightIcon,
    MenuIcon,
    XIcon,
    StarIcon,
  } from "$lib/icons/index.js";

  // Mobile menu state
  let mobileMenuOpen = $state(false);

  // Smooth scroll to section
  function scrollToSection(sectionId: string) {
    if (!browser) return;

    mobileMenuOpen = false; // Close mobile menu

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  // Handle navigation clicks
  function handleNavClick(target: string) {
    if (target === "home") {
      if (browser) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (target === "signup") {
      if (isInIframe()) {
        breakOutToPath("/register");
      } else {
        goto("/register");
      }
    } else {
      scrollToSection(target);
    }
  }

  // Key features data
  const features = [
    {
      icon: SparkleIcon,
      title: "65 Models",
      description:
        "Discover an expansive library of over 65 AI models tailored to your needs, from cutting-edge text-based LLMs like GPT, Claude, Gemini variants to specialized tools for creative generation.",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: ImageIcon,
      title: "Image Generation",
      description:
        "Transform your visions into reality with powerful image generation capabilities. Leverage text-to-image for creating stunning visuals from simple descriptions, or use image-to-image to refine and evolve existing photos with styles, edits, or enhancements.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: VideoIcon,
      title: "Video Generation",
      description:
        "Bring stories to life effortlessly through innovative video generation. Start with text-to-video to generate dynamic clips from written prompts, or elevate static assets with image-to-video for animated sequences and smooth transitions. ",
      gradient: "from-green-500 to-teal-500",
    },
    {
      icon: MessageCircleIcon,
      title: "Multimodal Chat",
      description:
        "Engage in intelligent, versatile conversations with our multimodal chat feature, where text-based LLMs integrate seamlessly with image and video inputs. Upload visuals to analyze, generate related content, or even iterate on ideas in real-time.",
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: SparkleIcon,
      title: "Why choose us?",
      description:
        "Experience unmatched versatility, speed, and affordability in one platform—backed by secure, scalable infrastructure for creators and enterprises alike.",
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      icon: ShieldIcon,
      title: "Get started now!",
      description:
        "Ready to unleash AI? Sign up for a free trial today and explore 65+ models with no credit card required.",
      gradient: "from-gray-600 to-gray-800",
    },
  ];

  // Pricing overview data
  const freePlan = {
    name: "FREE",
    price: "$0",
    period: "forever",
    features: [
      "Limited access to Text models",
      "Limited access to Image models",
    ],
  };

  const paidPlans = [
    {
      name: "STARTER",
      price: "$4.99",
      period: "month",
      features: [
        "Access to all text models",
        "Access to some image models",
        "Basic support",
      ],
    },
    {
      name: "PRO",
      price: "$14.99",
      period: "month",
      features: [
        "Access to all text models",
        "Access to all image models",
        "Access to some video models",
        "Increased limits",
        "Priority support",
      ],
    },
    {
      name: "ADVANCED",
      price: "$29.99",
      period: "month",
      features: [
        "Access to all text models",
        "Access to all image models",
        "Access to all video models",
        "Increased limits++",
        "Premium support",
      ],
    },
  ];
</script>

<svelte:head>
  <title>{settingsState.siteName}</title>
  <meta name="description" content={settingsState.siteDescription} />
  <meta
    name="keywords"
    content="AI models, text generation, image generation, video generation, Claude, GPT, Gemini, multimodal AI, OpenRouter, AI platform"
  />
  <meta property="og:title" content={settingsState.siteName} />
  <meta property="og:description" content={settingsState.siteDescription} />
  <meta property="og:type" content="website" />
</svelte:head>

<!-- Navigation Header -->
<nav
  class="sticky top-0 z-50 w-full border-gray-800 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60"
>
  <div class="container mx-auto px-4">
    <div class="flex h-16 items-center relative">
      <!-- Logo -->
      <div class="flex items-center">
        <Logo alt="App Logo" />
      </div>

      <!-- Desktop Navigation - Absolutely Centered -->
      <div class="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
        <NavigationMenu.Root class="relative">
          <NavigationMenu.List class="flex items-center space-x-1">
            <NavigationMenu.Item>
              <button
                class="cursor-pointer px-4 py-2 text-md font-medium text-gray-300 transition-colors hover:text-white"
                onclick={() => handleNavClick("features")}
              >
                Features
              </button>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <button
                class="cursor-pointer px-4 py-2 text-md font-medium text-gray-300 transition-colors hover:text-white"
                onclick={() => handleNavClick("pricing")}
              >
                Pricing
              </button>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <button
                class="cursor-pointer px-4 py-2 text-md font-medium text-gray-300 transition-colors hover:text-white"
                onclick={() => handleNavClick("faq")}
              >
                FAQ
              </button>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>

      <!-- CTA Button -->
      <div class="ml-auto hidden md:flex items-center">
        <Button
          onclick={() => handleNavClick("signup")}
          class="cursor-pointer bg-white text-black text-md font-semibold hover:bg-gray-300 transition-colors rounded-full"
        >
          Get Started for Free
          <ArrowRightIcon class="w-4 h-4 ml-2" />
        </Button>
      </div>

      <!-- Mobile Menu Button -->
      <div class="md:hidden ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          class="p-2"
        >
          {#if mobileMenuOpen}
            <XIcon class="w-5 h-5" />
          {:else}
            <MenuIcon class="w-5 h-5" />
          {/if}
        </Button>
      </div>
    </div>

    <!-- Mobile Navigation Menu -->
    {#if mobileMenuOpen}
      <div class="md:hidden border-t border-gray-800 bg-black">
        <div class="px-2 pt-2 pb-3 space-y-1">
          <button
            class="block w-full text-left px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-accent hover:text-white rounded-md"
            onclick={() => handleNavClick("features")}
          >
            Features
          </button>
          <button
            class="block w-full text-left px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-accent hover:text-white rounded-md"
            onclick={() => handleNavClick("pricing")}
          >
            Pricing
          </button>
          <button
            class="block w-full text-left px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-accent hover:text-white rounded-md"
            onclick={() => handleNavClick("faq")}
          >
            FAQ
          </button>
          <div class="px-3 py-2">
            <Button
              onclick={() => handleNavClick("signup")}
              class="w-full hover:bg-gray-300 text-black rounded-full"
            >
              Get Started for Free
              <ArrowRightIcon class="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</nav>

<!-- Hero Section -->
<section
  class="relative py-2 px-4 overflow-hidden"
  style="background-color: #101011"
>
  <!-- Background pattern -->
  <div class="absolute inset-0 opacity-20">
    <div
      class="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"
    ></div>
    <div
      class="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
    ></div>
  </div>

  <div class="container mx-auto relative">
    <div
      class="flex flex-col lg:flex-row gap-4 lg:gap-2 items-stretch min-h-[600px] lg:min-h-[800px]"
    >
      <!-- Left Column - Content -->
      <div
        class="w-full lg:w-2/5 flex flex-col justify-center space-y-10 lg:space-y-8 py-6 lg:py-31 px-16 rounded-2xl backdrop-blur-sm h-full"
        style="background-color: #0a0a0a"
      >
        <!-- Main Heading -->
        <h1
          class="text-2xl sm:text-2xl lg:text-4xl font-black tracking-tight text-white leading-tight"
        >
          Unlock AI Magic: Text, Images, Videos –
          <span
            class="bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-400 bg-clip-text text-transparent italic font-serif"
            >Create Without Limits</span
          >
        </h1>

        <!-- Subheading -->
        <p
          class="text-base sm:text-lg lg:text-xl text-gray-300 leading-relaxed max-w-lg"
        >
          Dive into endless AI possibilities: pick from top-tier LLMs, craft
          images from text or existing visuals, and animate videos starting with
          words or pictures—your creative toolkit awaits.
        </p>

        <!-- CTA Button -->
        <div class="flex">
          <Button
            size="lg"
            onclick={() => handleNavClick("signup")}
            class="cursor-pointer bg-white text-black px-8 py-3 text-lg font-semibold hover:bg-gray-300 transition-colors rounded-full"
          >
            Get Started for Free
            <ArrowRightIcon class="w-5 h-5 ml-2" />
          </Button>
        </div>

        <!-- Social Proof Section -->
        <div class="flex flex-col gap-4">
          <!-- User Avatars -->
          <div class="flex -space-x-2">
            <div
              class="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 border-2 border-gray-800"
            ></div>
            <div
              class="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 border-2 border-gray-800"
            ></div>
            <div
              class="w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 to-red-500 border-2 border-gray-800"
            ></div>
            <div
              class="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 border-2 border-gray-800"
            ></div>
            <div
              class="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 border-2 border-gray-800"
            ></div>
          </div>
          <!-- Stars and Text -->
          <div class="flex items-center gap-2">
            <div class="flex">
              <StarIcon class="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <StarIcon class="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <StarIcon class="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <StarIcon class="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <StarIcon class="w-4 h-4 fill-yellow-400 text-yellow-400" />
            </div>
            <span class="text-gray-300 text-sm font-medium"
              >Loved by over 1,000 creators!</span
            >
          </div>
        </div>
      </div>

      <!-- Right Column - Video Showcase -->
      <div
        class="w-full lg:w-3/5 flex justify-start items-start rounded-2xl p-4 lg:p-6 backdrop-blur-sm h-full"
        style="background-color: #0a0a0a"
      >
        <div class="relative w-full">
          <!-- App Showcase Videos -->
          <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start">
            <!-- First column - Video 1 (vertical, 2 rows) -->
            <div class="w-full sm:w-1/3 rounded-2xl overflow-hidden">
              <video
                autoplay
                muted
                loop
                class="w-full h-[300px] sm:h-[500px] lg:h-[680px] object-cover object-center"
              >
                <source
                  src="/landing-page/videos/landingpage-vid1.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            </div>
            <!-- Second column - Video 2 and 3 (stacked, 1 row each) -->
            <div class="w-full sm:w-1/3 flex flex-col gap-2 sm:gap-4">
              <!-- Video 2 - Top row -->
              <div class="rounded-2xl overflow-hidden">
                <video
                  autoplay
                  muted
                  loop
                  class="w-full h-[200px] sm:h-[250px] lg:h-[330px] object-cover object-center"
                >
                  <source
                    src="/landing-page/videos/landingpage-vid2.mp4"
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
              <!-- Video 3 - Bottom row -->
              <div class="rounded-2xl overflow-hidden">
                <video
                  autoplay
                  muted
                  loop
                  class="w-full h-[200px] sm:h-[250px] lg:h-[330px] object-cover object-center"
                >
                  <source
                    src="/landing-page/videos/landingpage-vid3.mp4"
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
            <!-- Third column - Video 4 (vertical, 2 rows) -->
            <div class="w-full sm:w-1/3 rounded-2xl overflow-hidden">
              <video
                autoplay
                muted
                loop
                class="w-full h-[300px] sm:h-[500px] lg:h-[680px] object-cover object-center"
              >
                <source
                  src="/landing-page/videos/landingpage-vid4.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Features Section -->
<section
  id="features"
  class="relative py-8 overflow-hidden"
  style="background-color: #101011"
>
  <!-- Background Pattern -->
  <div
    class="absolute inset-0"
    style="background: linear-gradient(to bottom, #101011, rgba(16, 16, 17, 0.5), #101011)"
  ></div>
  <div class="absolute inset-0 opacity-30">
    <div
      class="absolute top-20 left-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl"
    ></div>
    <div
      class="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"
    ></div>
    <div
      class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl"
    ></div>
  </div>

  <div class="container mx-auto relative">
    <!-- Section Header -->
    <div class="text-center mb-10">
      <h2 class="text-2xl sm:text-4xl font-black mb-6 tracking-tight">
        One Platform, Infinite AI: Text to Video, Imagination to Reality
      </h2>
      <p
        class="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
      >
        Choose from a vast array of AI models to bring your ideas to life:
        harness powerful text-based LLMs for intelligent responses, generate
        stunning visuals with text-to-image and image-to-image capabilities, and
        create dynamic content through text-to-video and image-to-video
        transformations—all in one seamless platform.
      </p>
    </div>

    <!-- Features Grid -->
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-4 mx-5">
      {#each features as feature, index}
        {@const Icon = feature.icon}
        <Card.Root
          class="border border-border hover:border-purple-500 transition-colors duration-200"
          style="background-color: #0a0a0a"
        >
          <Card.Content class="p-8">
            <!-- Icon -->
            <div class="mb-6">
              <div
                class={`w-16 h-16 rounded-3xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center`}
              >
                <Icon class="w-8 h-8 text-white" />
              </div>
            </div>

            <!-- Content -->
            <div class="space-y-4">
              <div>
                <h3 class="text-2xl font-bold mb-2">
                  {feature.title}
                </h3>
                <!-- Feature tags -->
                <div class="flex flex-wrap gap-2 mb-4">
                  {#if index === 0}
                    <Badge variant="secondary" class="text-xs"
                      >Text Generation</Badge
                    >
                    <Badge variant="secondary" class="text-xs"
                      >Image Generation</Badge
                    >
                    <Badge variant="secondary" class="text-xs"
                      >Video Generation</Badge
                    >
                  {:else if index === 1}
                    <Badge variant="secondary" class="text-xs">23+ Models</Badge
                    >
                  {:else if index === 2}
                    <Badge variant="secondary" class="text-xs">8+ Models</Badge>
                  {:else if index === 3}
                    <Badge variant="secondary" class="text-xs"
                      >File Upload</Badge
                    >
                    <Badge variant="secondary" class="text-xs"
                      >Chats History</Badge
                    >
                  {:else if index === 4}
                    <Badge variant="secondary" class="text-xs"
                      >Generous pricing model</Badge
                    >
                    <Badge variant="secondary" class="text-xs"
                      >Reliability</Badge
                    >
                  {:else}
                    <Badge variant="secondary" class="text-xs">GDPR</Badge>
                    <Badge variant="secondary" class="text-xs">Secure</Badge>
                  {/if}
                </div>
              </div>
              <p class="text-muted-foreground leading-relaxed text-base">
                {feature.description}
              </p>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </div>
</section>

<!-- Pricing Section -->
<section
  id="pricing"
  class="py-8 px-4"
  style="background: linear-gradient(to bottom, #101011, rgba(16, 16, 17, 0.8))"
>
  <div class="container mx-auto">
    <!-- Section Header -->
    <div class="text-center mb-6">
      <h2 class="text-3xl sm:text-4xl font-bold mb-4">
        Simple, Transparent Pricing
      </h2>
      <p class="text-lg text-muted-foreground max-w-2xl mx-auto">
        Start free and scale as you grow. No hidden fees, no surprises.
      </p>
    </div>

    <!-- Free Plan Card (Horizontal) -->
    <div class="flex justify-center mb-8">
      <Card.Root class="max-w-2xl w-full">
        <Card.Content class="px-5">
          <div
            class="flex items-center justify-between gap-4 md:flex-row flex-col"
          >
            <!-- Left: Title, Price -->
            <div class="flex items-center">
              <div>
                <h3 class="text-lg font-semibold mb-0.5">{freePlan.name}</h3>
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-semibold">{freePlan.price}</span>
                  <span class="text-sm text-muted-foreground"
                    >/{freePlan.period}</span
                  >
                </div>
              </div>
            </div>

            <!-- Center: Features -->
            <div class="flex-1 md:px-4">
              <div class="pricing-free-features">
                {#each freePlan.features as feature}
                  <div class="pricing-free-feature-item">
                    <div
                      class="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                    >
                      <svg
                        class="w-2 h-2 text-white"
                        fill="currentColor"
                        viewBox="0 0 8 8"
                      >
                        <path
                          d="M6.5 1l-3.5 3.5-1.5-1.5-1 1 2.5 2.5 4.5-4.5z"
                        />
                      </svg>
                    </div>
                    <span>{feature}</span>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Right: CTA Button -->
            <div class="flex-shrink-0">
              <Button
                class="cursor-pointer px-4 py-2 text-sm font-medium"
                variant="outline"
                onclick={() => {
                  if (isInIframe()) {
                    breakOutToPath("/register");
                  } else {
                    goto("/register");
                  }
                }}
              >
                Sign Up
                <ArrowRightIcon class="w-3 h-3 ml-2" />
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Paid Plans Grid -->
    <div class="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-6">
      {#each paidPlans as plan}
        <Card.Root
          class="relative transition-all duration-300 hover:shadow-lg h-full"
        >
          <Card.Content class="px-8 py-4 text-center h-full flex flex-col">
            <h3 class="text-xl font-bold mb-4">{plan.name}</h3>

            <div class="mb-6">
              <span class="text-4xl font-bold">
                {plan.price}
              </span>
              <span class="text-muted-foreground">/{plan.period}</span>
            </div>

            <ul class="space-y-3 mb-6 flex-grow">
              {#each plan.features as feature}
                <li class="flex items-center text-sm">
                  <div
                    class="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center mr-3 flex-shrink-0"
                  >
                    <svg
                      class="w-2 h-2 text-white"
                      fill="currentColor"
                      viewBox="0 0 8 8"
                    >
                      <path d="M6.5 1l-3.5 3.5-1.5-1.5-1 1 2.5 2.5 4.5-4.5z" />
                    </svg>
                  </div>
                  {feature}
                </li>
              {/each}
            </ul>

            <Button
              class="cursor-pointer w-full mt-auto"
              variant="outline"
              onclick={() => {
                if (isInIframe()) {
                  breakOutToPath("/pricing");
                } else {
                  goto("/pricing");
                }
              }}
            >
              Get Started
            </Button>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>

    <!-- View All Pricing Link -->
    <div class="text-center">
      <Button
        variant="ghost"
        onclick={() => {
          if (isInIframe()) {
            breakOutToPath("/pricing");
          } else {
            goto("/pricing");
          }
        }}
        class="cursor-pointer"
      >
        View detailed pricing
        <ArrowRightIcon class="w-4 h-4 ml-2" />
      </Button>
    </div>
  </div>
</section>

<!-- Final CTA Section -->
<section class="py-10 px-4" style="background-color: #101011">
  <div class="container mx-auto border rounded-2xl">
    <div class="relative rounded-3xl overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0" style="background-color: #101011"></div>

      <!-- Content -->
      <div class="relative px-8 py-14 text-center text-white">
        <h2 class="text-3xl sm:text-4xl font-bold mb-4">
          Ignite Your AI-Powered Future
        </h2>
        <p class="text-lg sm:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
          Your journey to effortless innovation starts here.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onclick={() => handleNavClick("signup")}
            class="cursor-pointer bg-white hover:bg-gray-300 px-8 py-3 text-lg font-semibold"
          >
            Get Started for Free
            <ArrowRightIcon class="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FAQ Section -->
<section id="faq" class="py-14 px-4" style="background-color: #101011">
  <div class="container mx-auto">
    <!-- Section Header -->
    <div class="text-center mb-16">
      <h2 class="text-3xl sm:text-4xl font-bold mb-2 text-white">
        Frequently Asked Questions
      </h2>
      <p class="text-lg text-gray-300 max-w-2xl mx-auto">
        Get answers to common questions about our platform
      </p>
    </div>

    <!-- FAQ Accordion -->
    <div class="max-w-2xl mx-auto">
      <Accordion.Root type="single">
        <Accordion.Item value="models">
          <Accordion.Trigger class="text-white text-lg">
            What AI models are available on your platform?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            We offer 65+ AI models from 9 different providers including
            OpenRouter (32+ text models), Google Gemini, OpenAI, xAI, Stability
            AI, Black Forest Labs, Kling AI, Luma Labs, and Alibaba. This
            includes text generation models like Claude, GPT, Gemini, and Llama,
            plus 25+ image generation models and 8+ video generation models.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="pricing">
          <Accordion.Trigger class="text-white text-lg">
            How does your pricing work?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            We offer a free tier with basic text generation, limited image
            creation, and chat history. Our Professional plan ($19/month)
            includes unlimited text generation, advanced image models, video
            generation, and priority support. Enterprise plans ($49/month) add
            custom limits.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="switching">
          <Accordion.Trigger class="text-white text-lg">
            Can I switch between models mid-conversation?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            Yes! You can seamlessly switch between any of our 65+ models during
            a conversation while maintaining your complete chat history. This
            allows you to leverage different model strengths for different tasks
            within the same conversation.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="files">
          <Accordion.Trigger class="text-white text-lg">
            What file types can I upload?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            Our multimodal chat supports image uploads (PNG, JPG, JPEG, WebP)
            and text files. You can upload images for analysis, editing, or to
            use as input for image-to-image and image-to-video generation across
            compatible models.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="security">
          <Accordion.Trigger class="text-white text-lg">
            Is my data secure and private?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            Yes, we prioritize your privacy and security. We're GDPR compliant,
            SOC2 certified, and maintain 99.9% uptime. Your conversations and
            generated content are securely stored with enterprise-grade
            encryption. We include bot protection via Cloudflare Turnstile and
            follow security best practices.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="advanced">
          <Accordion.Trigger class="text-white text-lg">
            Do you offer enterprise solutions?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            Yes! Our Advanced plan includes all Pro features plus custom usage
            limits, priority support, and advanced admin controls. Contact us
            for custom advanced solutions and volume pricing.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="free-tier">
          <Accordion.Trigger class="text-white text-lg">
            What's included in the free tier?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            Our free tier includes basic text generation capabilities, limited
            image creation, chat history storage, and access to select AI
            models. It's perfect for trying out the platform and light usage. No
            credit card required to get started.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="cancel">
          <Accordion.Trigger class="text-white text-lg">
            Can I cancel my subscription anytime?
          </Accordion.Trigger>
          <Accordion.Content class="text-gray-300 text-base">
            Absolutely! You can cancel your subscription at any time through
            your account settings. There are no long-term contracts or
            cancellation fees. Your access will continue until the end of your
            current billing period.
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="border-t py-8 px-4" style="background-color: #101011">
  <div class="container mx-auto text-center">
    <p class="text-sm text-muted-foreground">
      © 2025 WeaveAI. All rights reserved.
    </p>
  </div>
</footer>
