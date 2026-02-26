import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => {
  return (
    <div className="bg-background min-h-screen px-6 sm:px-8">
      <div className="max-w-4xl mx-auto py-16 md:py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition font-mono mb-10">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground font-mono mb-12">Last updated: February 2026</p>

        <div className="space-y-10 text-sm text-muted-foreground font-mono leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Montra Finance, you agree to be bound by these Terms of Service. If you
              do not agree to these terms, you should not use the platform. These terms apply to all users,
              visitors, and others who access the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">2. Description of Service</h2>
            <p>
              Montra Finance is a decentralized platform built on the Base blockchain that provides AI-driven
              quantitative trading tools, a strategy marketplace, and related services. The platform enables
              users to access market analysis, trading strategies, and decentralized finance functionalities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years of age to use Montra Finance. By using the platform, you represent
              and warrant that you meet this requirement and that you are not prohibited from using the service
              under any applicable laws or regulations in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">4. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are solely responsible for maintaining the security of your wallet and private keys.</li>
              <li>You are responsible for all activities that occur through your wallet on our platform.</li>
              <li>You agree not to use the platform for any unlawful or unauthorized purpose.</li>
              <li>You agree not to attempt to exploit, hack, or disrupt the platform or its smart contracts.</li>
              <li>You agree not to use automated systems to access the platform in a manner that exceeds reasonable use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">5. Tokens & Transactions</h2>
            <p>
              The $MONTRA token is a utility token used within the Montra Finance ecosystem. All token
              transactions are executed on the Base blockchain and are irreversible once confirmed. You
              acknowledge that token values may fluctuate and that you bear full responsibility for your
              transaction decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">6. Not Financial Advice</h2>
            <p>
              Nothing on the Montra Finance platform constitutes financial, investment, legal, or tax advice.
              All information, tools, and strategies provided are for informational and educational purposes only.
              You should consult with qualified professionals before making any financial decisions. Past performance
              of any strategy or tool does not guarantee future results.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">7. Risks</h2>
            <p className="mb-3">By using Montra Finance, you acknowledge and accept the following risks:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Market Risk:</strong> Digital asset prices are volatile and can result in significant losses.</li>
              <li><strong className="text-foreground">Smart Contract Risk:</strong> Smart contracts may contain bugs or vulnerabilities despite best efforts in development and auditing.</li>
              <li><strong className="text-foreground">Blockchain Risk:</strong> The Base network and underlying blockchain infrastructure may experience downtime, congestion, or other issues.</li>
              <li><strong className="text-foreground">Regulatory Risk:</strong> Cryptocurrency regulations vary by jurisdiction and may change, potentially affecting your ability to use the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">8. Intellectual Property</h2>
            <p>
              All content, branding, designs, and technology on the Montra Finance platform are the property
              of Montra Finance and are protected by applicable intellectual property laws. You may not copy,
              modify, distribute, or reproduce any part of the platform without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">9. Disclaimer of Warranties</h2>
            <p>
              Montra Finance is provided on an "as is" and "as available" basis without warranties of any kind,
              whether express or implied. We do not warrant that the platform will be uninterrupted, error-free,
              or free of harmful components. You use the platform entirely at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Montra Finance and its team shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not limited to
              loss of profits, data, or digital assets, arising from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">11. Termination</h2>
            <p>
              We reserve the right to restrict or terminate access to the platform at our discretion, without
              prior notice, for conduct that we believe violates these terms or is harmful to other users or
              the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">12. Changes to Terms</h2>
            <p>
              We may modify these Terms of Service at any time. Updated terms will be posted on this page with
              a revised date. Your continued use of the platform after any modifications constitutes acceptance
              of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-primary mb-3">13. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please reach out to us through our
              official community channels on <a href="https://x.com/MontraFinance" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">X (Twitter)</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
