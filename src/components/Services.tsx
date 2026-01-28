import { Code, Layout, Smartphone, Database, Search, Target } from "lucide-react";

const services = [
  {
    title: "Web Development",
    description: "Modern, responsive websites built with the latest technologies to ensure performance and scalability.",
    icon: Layout,
  },
  {
    title: "App Development",
    description: "Native and cross-platform mobile applications that provide seamless user experiences.",
    icon: Smartphone,
  },
  {
    title: "SEO Optimization",
    description: "Increase your visibility and rank higher on search engines with our proven strategies.",
    icon: Search,
  },
  {
    title: "Digital Marketing",
    description: "Targeted campaigns designed to grow your audience and maximize your ROI.",
    icon: Target,
  },
  {
    title: "Cloud Solutions",
    description: "Secure and scalable cloud infrastructure to power your growing business needs.",
    icon: Database,
  },
  {
    title: "UI/UX Design",
    description: "User-centric designs that are intuitive, beautiful, and focused on conversion.",
    icon: Code,
  },
];

export default function Services() {
  return (
    <section id="services" className="py-20 md:py-32 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Our Expertise</h2>
          <div className="h-1.5 w-20 bg-primary mx-auto rounded-full mb-6"></div>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed px-4">
            We provide comprehensive digital services to help businesses thrive in the modern era.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
          {services.map((service, index) => (
            <div
              key={index}
              className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group hover:-translate-y-2"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary transition-colors duration-300">
                <service.icon className="h-7 w-7 text-primary group-hover:text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                {service.title}
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
