import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="bg-background min-h-screen px-6 sm:px-8">
      <div className="max-w-4xl mx-auto py-16 md:py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition font-mono mb-10">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground font-mono mb-12">Last updated: February 2026</p>

        <div className="space-y-10 text-sm text-muted-foreground font-mono leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">1. Introduction</h2>
            <p>
              Welcome to Montra Finance. This Privacy Policy explains how we collect, use, and protect your
              information when you use our platform and services. By accessing or using Montra Finance, you
              agree to the terms outlined in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">2. Information We Collect</h2>
            <p className="mb-3">We may collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Wallet Information:</strong> Public wallet addresses used to interact with our platform. We do not collect or store private keys.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Information about how you interact with our platform, including pages visited, features used, and session duration.</li>
              <li><strong className="text-foreground">Device Information:</strong> Browser type, operating system, and device identifiers for analytics and compatibility purposes.</li>
              <li><strong className="text-foreground">Communication Data:</strong> Information you provide when contacting us through our community channels.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, maintain, and improve our platform and services</li>
              <li>To process transactions and interact with smart contracts on the Base blockchain</li>
              <li>To communicate updates, security alerts, and service-related notices</li>
              <li>To analyze usage patterns and optimize the user experience</li>
              <li>To detect, prevent, and address technical issues or fraudulent activity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">4. Blockchain Data</h2>
            <p>
              Montra Finance operates on the Base blockchain. Please be aware that blockchain transactions
              are publicly visible and immutable by nature. Any transaction you conduct through our platform
              will be recorded on the public blockchain and cannot be deleted or modified.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">5. Cookies & Analytics</h2>
            <p>
              We may use cookies and similar tracking technologies to enhance your experience on our platform.
              These help us understand how our services are used and allow us to improve functionality. You can
              manage your cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">6. Third-Party Services</h2>
            <p>
              Our platform may integrate with third-party services such as blockchain networks, wallet providers,
              and analytics tools. These services have their own privacy policies, and we encourage you to review
              them. We are not responsible for the privacy practices of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">7. Data Security</h2>
            <p>
              We implement reasonable security measures to protect your information. However, no method of
              electronic transmission or storage is completely secure. We cannot guarantee absolute security
              of your data, and you use the platform at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">8. Your Rights</h2>
            <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction or deletion of your personal information</li>
              <li>Opt out of certain data collection practices</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">9. Children's Privacy</h2>
            <p>
              Montra Finance is not intended for use by individuals under the age of 18. We do not knowingly
              collect personal information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page
              with an updated revision date. Your continued use of the platform after changes are posted
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please reach out to us through our
              official community channels on <a href="https://x.com/MontraFinance" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">X (Twitter)</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
