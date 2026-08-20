import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "The terms governing use of HorizonSpot's travel discovery platform.",
    alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "August 20, 2026";

export default function TermsPage() {
    return (
        <main className="max-w-4xl mx-auto px-6 py-16">
            <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>

            <p className="mb-8">
                Last updated: August 20, 2026
            </p>

            <section className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">1. About HorizonSpot</h2>
                    <p>
                        HorizonSpot is a travel discovery platform that helps users explore
                        hotels, restaurants, accommodations, attractions, and destinations.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold">2. Use of Our Website</h2>
                    <p>
                        By using HorizonSpot, you agree to use the website responsibly and
                        in accordance with applicable laws. You may not misuse, disrupt, or
                        attempt to gain unauthorized access to the website or its services.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold">3. Information on HorizonSpot</h2>
                    <p>
                        We work to provide useful and accurate information about travel
                        destinations and businesses. However, information such as prices,
                        availability, operating hours, and services may change. Users should
                        confirm important information directly with the relevant business.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold">4. Third-Party Services</h2>
                    <p>
                        HorizonSpot may connect with third-party services, including TikTok,
                        to provide certain features. These third-party services are governed
                        by their own terms and policies.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold">5. Changes to These Terms</h2>
                    <p>
                        We may update these Terms from time to time. Any changes will be
                        posted on this page with an updated date.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold">6. Contact Us</h2>
                    <p>
                        If you have questions about these Terms, contact us at{" "}
                        <a
                            href="mailto:hoppercloudtech@gmail.com"
                            className="text-gold-soft hover:underline"
                        >
                            hoppercloudtech@gmail.com
                        </a>.
                    </p>
                </div>
            </section>
        </main>
    );
}