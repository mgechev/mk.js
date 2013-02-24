opendir(DR, '.');

while (my $file = readdir(DR)) {
    next unless $file =~ /\.png$/;
    `convert $file -flop $file`;
}

closedir(DR);
