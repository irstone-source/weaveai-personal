import Root from "./card.svelte";
import Content from "./card-content.svelte";
import Description from "./card-description.svelte";
import Footer from "./card-footer.svelte";
import Header from "./card-header.svelte";
import Title from "./card-title.svelte";
import Action from "./card-action.svelte";

// Create a hybrid export that works as both a component (<Card />)
// and a namespace for subcomponents (<Card.Content />)
// This preserves existing usage across the codebase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Card: any = Root;
Card.Root = Root;
Card.Content = Content;
Card.Description = Description;
Card.Footer = Footer;
Card.Header = Header;
Card.Title = Title;
Card.Action = Action;

export {
	Root,
	Content,
	Description,
	Footer,
	Header,
	Title,
	Action,
	// Hybrid export
	Card,
	// Named subcomponent exports for direct import usage
	Content as CardContent,
	Description as CardDescription,
	Footer as CardFooter,
	Header as CardHeader,
	Title as CardTitle,
	Action as CardAction,
};
