import { createSignal } from "solid-js";
import { ONBOARDING_STEPS } from "../../lib";

interface OnboardingProps {
  onComplete: () => void;
}

export default function OnboardingScreen(props: OnboardingProps) {
  const [stepIndex, setStepIndex] = createSignal(0);

  const step = () => ONBOARDING_STEPS[stepIndex()];

  const handleNext = () => {
    if (stepIndex() + 1 === ONBOARDING_STEPS.length) {
      props.onComplete();
    } else {
      setStepIndex((s) => s + 1);
    }
  };

  return (
    <div class="flex h-screen w-screen items-center justify-center">
      <div class="flex flex-col gap-6 max-w-xl w-full">
        {/* Content */}
        <div class="flex flex-col gap-2">
          <h1 class="text-2xl font-bold text-text">{step().title}</h1>
          <p class="text-subtext-1 leading-relaxed">{step().description}</p>
        </div>

        {step().image && (
          <img
            src={step().image}
            alt={step().title}
            class="rounded-lg w-full"
          />
        )}

        {/* Button */}
        <button onClick={handleNext} class="self-end">
          {stepIndex() + 1 === ONBOARDING_STEPS.length ? "Let me in!" : "Next"}
        </button>
      </div>
    </div>
  );
}
