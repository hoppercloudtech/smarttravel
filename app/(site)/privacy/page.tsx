import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "How HorizonSpot collects, uses, and protects information.",
    alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "August 20, 2026";

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto max-w-4xl px-6 py-16">
                <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>

                <p className="text-muted-foreground mb-10">
                    Last updated: August 20, 2026
                </p>

                <div className="space-y-10">
                    <section>
                        <p className="text-lg leading-8">
                            HorizonSpot respects your privacy. This Privacy Policy explains
                            how we handle information when you use our website.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            Information We Collect
                        </h2>

                        <p className="leading-8">
                            HorizonSpot does not require ordinary visitors to create an
                            account or provide personal information. We may collect limited
                            technical information, such as search activity, page visits, and
                            standard server information, to help improve and operate the
                            website.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            TikTok Integration
                        </h2>

                        <p className="leading-8">
                            Authorized HorizonSpot administrators may connect a TikTok
                            account to our platform. We use TikTok's official Login Kit and
                            Content Posting API to allow authorized accounts to connect and
                            publish travel-related content to TikTok.
                        </p>

                        <p className="leading-8 mt-3">
                            We only use TikTok information and permissions necessary to
                            operate these features.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            Cookies and Security
                        </h2>

                        <p className="leading-8">
                            We may use essential cookies or temporary security information to
                            maintain administrator sessions and securely connect third-party
                            services such as TikTok. We do not use advertising or unnecessary
                            tracking cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            Third-Party Services
                        </h2>

                        <p className="leading-8">
                            HorizonSpot may use trusted third-party services to operate the
                            website, including hosting, database, image storage, AI services,
                            and TikTok integration. These services may process information as
                            necessary to provide their services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            Your Choices
                        </h2>

                        <p className="leading-8">
                            If you have questions about your information, a business listing,
                            or our privacy practices, you can contact us at{" "}
                            <a
                                href="mailto:hoppercloudtech@gmail.com"
                                className="text-gold-soft hover:underline"
                            >
                                hoppercloudtech@gmail.com
                            </a>
                            .
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-3">
                            Changes to This Policy
                        </h2>

                        <p className="leading-8">
                            We may update this Privacy Policy when necessary. Any changes
                            will be posted on this page with an updated date.
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
}