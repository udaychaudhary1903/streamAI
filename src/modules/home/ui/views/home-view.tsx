import { CategoriesSection } from "../sections/categories-section";
import { LivestreamsSection } from "../sections/livestreams-section";

interface HomeViewProps {
    categoryId?: string;
}

export const HomeView = ({ categoryId }: HomeViewProps) => {
    return (
        <div className="max-w-[2400px] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
            {/* Live streams row - shows only if streams are active */}
            <LivestreamsSection categoryId={categoryId} />

            {/* Existing categories + videos */}
            <CategoriesSection categoryId={categoryId} />
        </div>
    );
};