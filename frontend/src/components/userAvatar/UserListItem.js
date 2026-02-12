import { Avatar } from "@chakra-ui/avatar";
import { Box, Text, Flex } from "@chakra-ui/layout";

const UserListItem = ({ user, handleFunction }) => {
  return (
    <Box
      onClick={handleFunction}
      cursor="pointer"
      bg="rgba(255, 255, 255, 0.05)"
      _hover={{
        bg: "linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(236, 72, 153, 0.3))",
        transform: "translateX(5px)",
        borderColor: "rgba(168, 85, 247, 0.5)",
      }}
      w="100%"
      display="flex"
      alignItems="center"
      color="white"
      px={{ base: 3, md: 4 }}
      py={{ base: 2.5, md: 3 }}
      mb={2}
      borderRadius="xl"
      transition="all 0.2s ease"
      border="1px solid rgba(255, 255, 255, 0.1)"
    >
      {/* Fixed Avatar with proper sizing */}
      <Box
        mr={{ base: 2, md: 3 }}
        w={{ base: "36px", md: "44px" }}
        h={{ base: "36px", md: "44px" }}
        borderRadius="full"
        overflow="hidden"
        border="2px solid"
        borderColor="purple.400"
        bg="purple.500"
        flexShrink={0}
      >
        {user.pic ? (
          <Box
            as="img"
            src={user.pic}
            alt={user.name}
            w="100%"
            h="100%"
            objectFit="cover"
            loading="lazy"
          />
        ) : (
          <Avatar
            size="full"
            name={user.name}
            bg="purple.500"
            color="white"
          />
        )}
      </Box>
      <Box flex="1" minW={0}>
        <Text fontWeight="600" fontSize={{ base: "sm", md: "md" }} isTruncated>
          {user.name}
        </Text>
        <Flex align="center" gap={1}>
          <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.400" isTruncated>
            📧 {user.email}
          </Text>
        </Flex>
      </Box>
    </Box>
  );
};

export default UserListItem;
