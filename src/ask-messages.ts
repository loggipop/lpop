/**
 * Quirky message templates for asking colleagues for environment variables
 */

const ASK_MESSAGES = [
  "🙏 Help a fellow developer out! I'm missing some environment variables:",
  '🚨 SOS! My .env file is feeling a bit empty. Could you help me with:',
  '🔑 Secret ingredient missing! Hook me up with these variables:',
  '🎭 Playing hide and seek with some env vars. Mind sharing:',
  '🔍 Environment variable detective work needed! Please share:',
  '💎 Looking for these precious environment gems:',
  '🧩 Missing puzzle pieces for my environment! Can you provide:',
  '🎪 Step right up and share these magical variables:',
  '🏴‍☠️ Ahoy! Seeking treasure (aka environment variables):',
  '🌟 Calling all env var wizards! I need these spells:',
  '🎯 Target acquired: environment variables. Please deploy:',
  '🔮 Crystal ball says I need these variables. Can you share:',
  '🎨 Painting my environment, but missing these colors:',
  '🚀 Mission control, requesting these variables for launch:',
  '🎵 My environment is singing the blues without these vars:',
  '🍕 My development environment is hungry for these toppings:',
  '🎲 Rolling the dice and hoping you can share these variables:',
  '🏆 Champion env var sharer needed! Please provide:',
  '🎪 The greatest show on earth needs these environment variables:',
  '🔥 My build is fire, but it needs these variables to ignite:',
];

/**
 * Gets a random quirky message template
 */
export const getRandomAskMessage = (): string => {
  const randomIndex = Math.floor(Math.random() * ASK_MESSAGES.length);
  return ASK_MESSAGES[randomIndex];
};

/**
 * Formats the complete ask message with public key
 */
export const formatAskMessage = (
  publicKey: string,
  serviceName: string,
  environment?: string,
): string => {
  const quirkMessage = getRandomAskMessage();
  const envSuffix = environment ? ` [${environment}]` : '';

  return `${quirkMessage}

Repository: ${serviceName}${envSuffix}

lpop give ${publicKey}`;
};
