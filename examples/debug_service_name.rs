use lpop::git_resolver::GitPathResolver;

fn main() {
    let resolver = GitPathResolver::new(None);
    let service_name = resolver.generate_service_name("development");
    println!("Service name: {}", service_name);
}