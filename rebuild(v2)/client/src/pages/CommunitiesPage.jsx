import { SparklesIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function CommunitiesPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-grow flex flex-col justify-center items-center py-20 px-6 font-sans text-center bg-background min-h-[70vh]">
      <div className="max-w-md w-full bg-card border border-border/80 rounded-[32px] p-8 shadow-sm space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto animate-bounce">
          <SparklesIcon className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h1
            className="text-3xl font-black text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Communities
          </h1>
          <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase font-mono">
            New Feature
          </p>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
          Gather with citizens of matching affiliations, host debates, and organize civic movements. This option will be available soon.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="rounded-full px-6 font-black uppercase text-[10px] tracking-widest cursor-pointer h-11 w-full gap-2 hover:bg-secondary"
        >
          <ArrowLeftIcon className="w-3 h-3" /> Go Back
        </Button>
      </div>
    </div>
  );
}

export default CommunitiesPage;
