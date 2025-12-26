"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useApiKey } from "@/hooks/use-api-key";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { PageSidebar } from "@/components/editor/page-sidebar";
import { ComicCanvas } from "@/components/editor/comic-canvas";
import { ApiKeyModal } from "@/components/api-key-modal";
import { PageInfoSheet } from "@/components/editor/page-info-sheet";
import { GeneratePageModal } from "@/components/editor/generate-page-modal";
import { StoryLoader } from "@/components/ui/story-loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PageData {
  id: number; // pageNumber for component compatibility
  title: string;
  image: string;
  prompt: string;
  characterUploads?: string[];
  style: string;
  dbId?: string; // actual database UUID
}

interface StoryData {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  style: string;
  userId?: string | null;
  isOwner?: boolean;
}

export function StoryEditorClient() {
  const params = useParams();
  const slug = params.storySlug as string;

  const [story, setStory] = useState<StoryData | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);
  const [loadingPageId, setLoadingPageId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [existingCharacterImages, setExistingCharacterImages] = useState<
    string[]
  >([]);
  const { toast } = useToast();
  const [apiKey, setApiKey] = useApiKey();

  // Load story and pages from API
  useEffect(() => {
    const loadStoryData = async () => {
      try {
        const response = await fetch(`/api/stories/${slug}`);
        if (!response.ok) {
          throw new Error("Story not found");
        }

        const result = await response.json();
        console.log("Editor: full API response:", result);

        const {
          story: storyData,
          pages: pagesData,
          isOwner: ownerStatus,
        } = result;

        console.log("Editor: received story data:", storyData);

        setStory(storyData);
        setIsOwner(ownerStatus ?? false); // Default to false if undefined
        setPages(
          pagesData.map((page: any) => ({
            id: page.pageNumber,
            title: storyData.title,
            image: page.generatedImageUrl || "",
            prompt: page.prompt,
            characterUploads: page.characterImageUrls,
            style: storyData.style || "noir",
            dbId: page.id,
          }))
        );

        // Load existing character images for reuse
        const uniqueImages = [
          ...new Set(
            pagesData.flatMap((page: any) => page.characterImageUrls || [])
          ),
        ];
        setExistingCharacterImages(uniqueImages as string[]);
      } catch (error) {
        console.error("Error loading story:", error);
        toast({
          title: "Error loading story",
          description: "Failed to load story data.",
          variant: "destructive",
          duration: 4000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      loadStoryData();
    }
  }, [slug, toast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowRight") {
        setCurrentPage((prev) => (prev < pages.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowLeft") {
        setCurrentPage((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "i" || e.key === "I") {
        setShowInfoSheet(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pages.length]);

  const handleAddPage = () => {
    if (!apiKey && pages.length >= 1) {
      setShowApiModal(true);
      return;
    }
    setShowGenerateModal(true);
  };

  const handleRedrawPage = async () => {
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }

    const currentPageData = pages[currentPage];
    if (!currentPageData) return;

    setLoadingPageId(currentPage);

    try {
      const response = await fetch("/api/add-page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          storyId: story?.slug,
          pageId: currentPageData.dbId, // Add pageId to override existing page
          prompt: currentPageData.prompt,
          characterImages: currentPageData.characterUploads || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to redraw page");
      }

      const result = await response.json();

      // Update the current page with the new image
      setPages((prevPages) =>
        prevPages.map((page, index) =>
          index === currentPage ? { ...page, image: result.imageUrl } : page
        )
      );

      toast({
        title: "Page redrawn successfully",
        description: "The page has been regenerated with a fresh image.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error redrawing page:", error);
      toast({
        title: "Failed to redraw page",
        description:
          error instanceof Error ? error.message : "Failed to redraw page",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setLoadingPageId(null);
    }
  };

  const handleApiKeyClick = () => {
    setShowApiModal(true);
  };

  const handleDeletePage = (pageIndex: number) => {
    setPageToDelete(pageIndex);
    setShowDeleteDialog(true);
  };

  const confirmDeletePage = async () => {
    if (pageToDelete === null) return;

    const pageData = pages[pageToDelete];
    if (!pageData) return;

    setShowDeleteDialog(false);

    try {
      const response = await fetch("/api/delete-page", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storySlug: story?.slug,
          pageId: pageData.dbId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete page");
      }

      // Remove the page from state
      setPages((prevPages) => {
        const newPages = prevPages.filter((_, index) => index !== pageToDelete);
        // Adjust currentPage if necessary
        if (currentPage >= newPages.length) {
          setCurrentPage(Math.max(0, newPages.length - 1));
        } else if (currentPage > pageToDelete) {
          setCurrentPage(currentPage - 1);
        }
        return newPages;
      });

      toast({
        title: "Page deleted successfully",
        description: "The page has been removed from your comic.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error deleting page:", error);
      toast({
        title: "Failed to delete page",
        description:
          error instanceof Error ? error.message : "Failed to delete page",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setPageToDelete(null);
    }
  };

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setShowApiModal(false);
    const wasGenerating = showGenerateModal;
    if (wasGenerating) {
      setShowGenerateModal(true);
    }
  };

  const handleGeneratePage = async (data: {
    prompt: string;
    characterUrls?: string[];
  }): Promise<void> => {
    if (!apiKey) {
      setShowApiModal(true);
      throw new Error("API key required");
    }

    // Add new page mode
    const response = await fetch("/api/add-page", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        storyId: story?.slug,
        prompt: data.prompt,
        characterImages: data.characterUrls || [],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate page");
    }

    const result = await response.json();

    // Update character images list with new ones
    const newCharacterUrls = data.characterUrls || [];
    setExistingCharacterImages((prev) => {
      const combined = [...prev, ...newCharacterUrls];
      // Remove duplicates while preserving order
      const unique = Array.from(new Set(combined));
      return unique;
    });

    setPages((prevPages) => [
      ...prevPages,
      {
        id: pages.length + 1,
        title: story?.title || "",
        image: result.imageUrl,
        prompt: data.prompt,
        characterUploads: data.characterUrls || [],
        style: story?.style || "noir",
        dbId: result.pageId,
      },
    ]);
    setCurrentPage(pages.length);

    setShowGenerateModal(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <StoryLoader />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-white">Story not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        title={story.title}
        onContinueStory={handleAddPage}
        isOwner={isOwner}
      />

      <div className="flex-1 flex overflow-hidden">
        <PageSidebar
          pages={pages}
          currentPage={currentPage}
          onPageSelect={setCurrentPage}
          onAddPage={handleAddPage}
          loadingPageId={loadingPageId}
          onApiKeyClick={handleApiKeyClick}
          isOwner={isOwner}
        />
        <ComicCanvas
          page={pages[currentPage]}
          pageIndex={currentPage}
          totalPages={pages.length}
          isLoading={loadingPageId === currentPage}
          isOwner={isOwner}
          onInfoClick={() => setShowInfoSheet(true)}
          onRedrawClick={handleRedrawPage}
          onDeletePage={() => handleDeletePage(currentPage)}
          onNextPage={() =>
            setCurrentPage((prev) =>
              prev < pages.length - 1 ? prev + 1 : prev
            )
          }
          onPrevPage={() =>
            setCurrentPage((prev) => (prev > 0 ? prev - 1 : prev))
          }
        />
      </div>

      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSubmit={handleApiKeySubmit}
      />
      <GeneratePageModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGeneratePage}
        pageNumber={pages.length + 1}
        existingCharacters={existingCharacterImages}
        lastPageCharacters={
          pages.length > 0 && pages[pages.length - 1]?.characterUploads
            ? pages[pages.length - 1].characterUploads || []
            : []
        }
        previousPageCharacters={
          pages.length > 1 && pages[pages.length - 2]?.characterUploads
            ? pages[pages.length - 2].characterUploads || []
            : []
        }
      />
      <PageInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
        page={pages[currentPage]}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete page{" "}
              {pageToDelete !== null ? pageToDelete + 1 : ""}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePage}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
