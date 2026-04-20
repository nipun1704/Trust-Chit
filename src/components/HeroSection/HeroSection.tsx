import { motion } from "framer-motion";

// Simplified hero without the finance dashboard preview or floating stat boxes
const HeroSection = () => (
  <section className="relative min-h-[60vh] flex items-center justify-center px-4 md:px-8 overflow-hidden">
    {/* Subtle background accents retained */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-1/2 -left-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#a3e635]/10 to-transparent rounded-full filter blur-3xl" />
      <div className="absolute -bottom-1/2 -right-1/2 w-[800px] h-[800px] bg-gradient-to-tl from-[#81c784]/10 to-transparent rounded-full filter blur-3xl" />
    </div>
    <div className="relative z-10 max-w-4xl w-full">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#a3e635] to-[#81c784]">
            Secure, Transparent, and Easy
          </span>
          <br />
          <span className="text-white">Chit Fund Management</span>
        </h1>
        <p className="text-lg md:text-xl text-[#cbd5c0] mb-8 max-w-2xl mx-auto">
          Experience the future of chit fund management with enhanced security, real-time transparency, and an intuitive platform that puts you in control.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 4px 20px rgba(163, 230, 53, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="bg-[#a3e635] text-[#181f16] font-semibold px-8 py-3 rounded-full hover:bg-[#b7f36b] transition-all duration-300"
          >
            Get Started
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="bg-transparent border-2 border-[#a3e635] text-[#a3e635] font-semibold px-8 py-3 rounded-full hover:bg-[#a3e635]/10 transition-all duration-300"
          >
            Learn More
          </motion.button>
        </div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
