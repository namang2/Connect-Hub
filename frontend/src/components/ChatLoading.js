import { Stack, Flex, Box } from "@chakra-ui/layout";
import { Skeleton, SkeletonCircle } from "@chakra-ui/skeleton";

const ChatLoading = () => {
  return (
    <Stack spacing={3}>
      {[...Array(6)].map((_, i) => (
        <Flex
          key={i}
          p={3}
          borderRadius="xl"
          bg="rgba(255, 255, 255, 0.03)"
          border="1px solid rgba(255, 255, 255, 0.05)"
          align="center"
          gap={3}
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <SkeletonCircle
            size="12"
            startColor="rgba(168, 85, 247, 0.2)"
            endColor="rgba(236, 72, 153, 0.2)"
          />
          <Box flex="1">
            <Skeleton
              height="14px"
              width="60%"
              mb={2}
              borderRadius="full"
              startColor="rgba(168, 85, 247, 0.2)"
              endColor="rgba(236, 72, 153, 0.2)"
            />
            <Skeleton
              height="10px"
              width="80%"
              borderRadius="full"
              startColor="rgba(255, 255, 255, 0.05)"
              endColor="rgba(255, 255, 255, 0.1)"
            />
          </Box>
        </Flex>
      ))}
    </Stack>
  );
};

export default ChatLoading;
