import { motion } from "framer-motion";

const connectionImg = "/images/section-connection.jpg";
const activityImg = "/images/section-activity.jpg";
const afterImg = "/images/section-after.jpg";
const cheersImg = "/images/section-cheers.jpg";

const textUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } },
};

const imgUp = {
  hidden: { opacity: 0, y: 80, scale: 1.02 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const } },
};

const StorySection = () => (
  <>
    {/* Statement */}
    <section className="px-6 py-32 lg:px-12 lg:py-44">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-120px" }}
        variants={textUp}
        className="mx-auto max-w-4xl text-center"
      >
        <h2 className="font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl text-balance">
          Everyone comes alone.
          <br />
          <span className="italic text-white/40">That's the whole point.</span>
        </h2>
      </motion.div>
    </section>

    {/* Immersive sections */}
    {[
      {
        tag: "Before",
        headline: "Don't walk in blind.",
        body: "You see the activity, the vibe, the group size, who's hosting. You decide if it's for you — before you show up.",
        img: connectionImg,
        alt: "Friends connecting over conversation",
      },
      {
        tag: "During",
        headline: "The activity carries you.",
        body: "The host makes sure nobody's standing alone. The small group means you actually get to know people.",
        img: activityImg,
        alt: "Group of friends enjoying an activity together",
        reverse: true,
      },
      {
        tag: "After",
        headline: "One hang plants the seed.",
        body: "Group chat opens. Follow-up hangs happen if the group clicks. Your future matches improve based on feedback.",
        img: afterImg,
        alt: "Friends celebrating together",
      },
    ].map((section) => (
      <section key={section.tag} className="overflow-hidden">
        <div className="grid min-h-[80vh] lg:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={textUp}
            className={`flex flex-col justify-center px-6 py-20 lg:px-16 xl:px-24 ${
              section.reverse ? "lg:order-2" : ""
            }`}
          >
            <span className="mb-5 inline-block w-fit border-b border-white/20 pb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
              {section.tag}
            </span>
            <h2 className="mb-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              {section.headline}
            </h2>
            <p className="max-w-md text-base leading-relaxed text-white/45 lg:text-lg">
              {section.body}
            </p>
          </motion.div>
          <div className={`overflow-hidden ${section.reverse ? "lg:order-1" : ""}`}>
            <motion.img
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={imgUp}
              src={section.img}
              alt={section.alt}
              className="h-full min-h-[50vh] w-full object-cover"
            />
          </div>
        </div>
      </section>
    ))}

    {/* Full-bleed image break */}
    <section className="relative h-[60vh] overflow-hidden">
      <motion.img
        initial={{ scale: 1.08, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] as const }}
        src={cheersImg}
        alt="Friends celebrating together"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,8%)] via-[hsl(220,20%,8%,0.3)] to-[hsl(220,20%,8%,0.6)]" />
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={textUp}
        className="absolute inset-0 flex items-center justify-center px-6"
      >
        <p className="font-display text-3xl font-bold italic text-white/80 text-center sm:text-4xl lg:text-5xl">
          "We're hanging out again this weekend."
        </p>
      </motion.div>
    </section>
  </>
);

export default StorySection;
