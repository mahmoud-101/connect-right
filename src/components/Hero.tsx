import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Shield, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-16 md:pt-48 md:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs md:text-sm font-medium text-blue-700 uppercase tracking-wider">
              Ready to Connect Your Business
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
            Connect Your Business to the <span className="text-primary italic">Digital World</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto px-4">
            We bridge the gap between your ideas and reality with cutting-edge 
            technology solutions tailored for growth.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
            <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full shadow-lg hover:shadow-xl transition-all">
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full">
              View Case Studies
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto text-left">
            {[
              { icon: Zap, text: "Fast Deployment", color: "text-amber-500" },
              { icon: Shield, text: "Secure Infrastructure", color: "text-emerald-500" },
              { icon: Globe, text: "Global Reach", color: "text-blue-500" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-white/50 rounded-xl border border-gray-100 shadow-sm transition-hover hover:shadow-md">
                <item.icon className={`h-6 w-6 ${item.color}`} />
                <span className="text-sm font-semibold text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-30 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-200/50 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-200/50 rounded-full blur-3xl"></div>
      </div>
    </section>
  );
}
