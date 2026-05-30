import { getPublicRestaurant } from "@/features/repositories";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const restaurant = await getPublicRestaurant(slug);
  if (!restaurant) return new Response("Not found", { status: 404 });
  const origin = process.env.APP_URL ?? new URL(request.url).origin;
  const src = `${origin}/r/${restaurant.slug}?embed=1`;
  const script = `
    (function () {
      var current = document.currentScript;
      var iframe = document.createElement('iframe');
      iframe.src = ${JSON.stringify(src)};
      iframe.title = ${JSON.stringify(`Reservas ${restaurant.name}`)};
      iframe.loading = 'lazy';
      iframe.style.width = '100%';
      iframe.style.height = '720px';
      iframe.style.border = '0';
      iframe.style.borderRadius = '8px';
      (current && current.parentNode ? current.parentNode : document.body).insertBefore(iframe, current || null);
    })();
  `;
  return new Response(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
